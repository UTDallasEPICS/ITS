# ADR 002: Real Time Chat

- **Status:** Proposed
- **Deciders:** Jason, Tushar
- **Date:** 2026-10-09

---

## 1. Context & Problem Statement


We have a chat feature in the application. We've already planned how to store chat messages in the database, but a key requirement/user expectation for a chat feature is instant updates, meaning we need to have a way to get chat messages to live update on user devices as they're received. We need to decide on a mechanism for getting new messages in a chat thread to all the users who may be currently viewing it at a given point in time.

---

## 2. Decision Drivers (Goals & Constraints)


- Users should be able to see other people's messages within a reasonably short time frame after a user has sent it from their device.
  - Kinda spitballing but given optimal network conditions, I think <5s from receiving a given message on the server to seeing it on all client devices is reasonable
- Looking for the solution that is least complex (operationally + code wise) while also remaining performant.
- As of time of writing, the app will be deployed to AWS ECS, as a single Docker container. Open question posed to the project partner: will the app scale to more than 1 replica in the near/long term? Options were researched which make more/less sense based on the answer to this question.
- Chat access control is still important - only members of a thread should see the given messages. Our selected solution should allow the server to enforce access control guards on messages even in the live update path.



---

## 3. Options Considered

### Option 1: Polling

Implement an API endpoint like `GET /api/chats/:threadId/messages?after=<lastPulledMessageId>` which each client hits on a fixed interval (probably every couple seconds). 

- **Pros:**
  - Easy to implement
- **Cons:**
  - Slow b/c we need to wait for users to ask the server for new messages before they are seen, as opposed to just being instantly notified when the server receives new messages 
  - Could cause performance issues on the server because we are continually making requests on a fixed interval, waiting for messages. As the number of clients connected to a given chat thread increases, so also does the number of requests being sent out


### Option 2: Nitro WebSockets

Nuxt is built on top of a framework called Nitro which has built-in support for WebSockets. This is even better than implementing a regular Node stdlib WebSocket server because Nitro adds the concept of namespaces, which eliminates the need for us to handle in process pub/sub. Nitro internally handles shuttling messages between all connected peers in a given 'namespace', which maps perfectly to sending updates to members of each chat thread. Docs from Nitro for their WebSockets support: https://nitro.build/docs/websocket#pubsub

- **Pros:**
  - Actually instant updates
  - More performant than polling
  - Relatively easy to implement since it's built into the framework
- **Cons:**
  - have to keep the websocket alive / handle reconnects on client side as needed
  - If clients connect to different instances of the server (like if we ever deployed more than one ITS instance behind a load balancer) we would have to use LB with support for sticky sessions or use something to shuttle events between server instances

### Option 3: Nuxt custom hooks + Nitro WebSockets

This is the same as option 2, but uses Nuxt custom hooks as the means for 'pub/sub' instead of relying on WebSocket namespaces. Docs for Nuxt's custom hook support: https://nuxt.com/docs/4.x/guide/going-further/hooks#adding-custom-hooks

- **Pros**
  - Actually instant updates
  - More performant than polling
  - Relatively easy to implement since it's built into the framework
  - By emitting server-side events when messages are received on the server, we can implement other side effects of chat (e.g. email notifications) cleanly and separately from the chat service
- **Cons**
  - Slightly more technical effort than just the Nitro WebSockets option
  - If clients connect to different instances of the server (like if we ever deployed more than one ITS instance behind a load balancer) we would have to use LB with support for sticky sessions or use something to shuttle events between server instances

### Option 4: Redis PubSub + Nitro WebSockets

To address the multi-instance issue presented by using in-memory event emitters for pub/sub, Redis was considered as an event broker. Redis is a key/value store which also has pub/sub capabilities. If we were to use Redis, each server could subscribe to changes for a given key (ex: `chat_thread_messages:<thread_id>`) and use those notifications as the trigger to send new messages to WebSocket clients connected to that server.

- **Pros:**
  - Actually instant updates
  - More performant than polling
  - Supports scaling ITS past one instance
- **Cons:**
  - Have to deal with time/effort costs of operating another service locally and in prod
  - Adds more steps in the message sending/receiving flow + adds new point of failure

### Option 5: Unstorage for Redis / in memory KV subscription + Nitro WebSockets

This is basically the same as option 4, but uses unstorage as a facade/wrapper library. [Unstorage](https://unstorage.unjs.io/guide) is a library that abstracts the details of accessing various KV/blob stores behind a simple shared API - and it's already bundled with Nuxt/Nitro so we're not technically adding a new dependency. This has the advantage of making it possible to switch between different storage backends which still have the same pub/sub capabilities, without coding specifically to the interface of a certain service's library. This makes switching between Redis or simple in-memory pub-sub a question of config updates and not major code changes, So if/when ITS has to scale past one instance, we would configure ITS to use a [Redis storage backend](https://unstorage.unjs.io/drivers/redis), but in local development + single replica ITS deployments we can just use the [in-memory storage backend](https://unstorage.unjs.io/drivers/memory), which all support [watching keys for changes](https://unstorage.unjs.io/guide#watching-changes).

- **Pros:**
  - Actually instant updates
  - More performant than polling
  - Supports scaling ITS past one instance w/out forcing operation of another service
- **Cons:**
  - Most complicated code imo

---

## 4. Decision & Justification

**Chosen Option:** Option [3] — Nuxt Custom Hooks + Nitro WebSockets

### Rationale

Explain why this option was selected over the others. Connect the decision back to the goals and constraints in Section 2.

> Example: We chose Option 2 because it meets our cost budget of under $5 while providing significantly better read/write speed than Option 1. Although Option 3 offered better long-term reliability, its high unit price makes it unfeasible for our production scale.

The first decision was effectively 'polling or websockets?', which was pretty much decided based on engineering effort / most optimal UX. On the frontend, both methods are mostly the same from a state management perspective: either way, we're getting new messages and having to update what is being rendered on screen as the client gets new messages, and both long polling and WebSockets would need some extra logic to handle starting + stopping subscriptions. 

WebSockets do introduce a little bit of additional complexity. Connections get dropped when the server reboots (ex: new update deployment) so the client needs to handle reconnecting cleanly. Long-running connections mean specific considerations around deployment - you must use some sort of long-lived server, and you must only use one deployed server OR architect your multi-instance deployment to handle sticky sessions or some mechanism for pub/sub. 

But WebSockets best support our goal of dispatching messages to all clients as instantly as possible. We decided that the relatively slight increase in engineering effort by using WebSockets was worth the improvement in UX.

After discussing with the project partner, it was noted that the project's AWS deployment would not need to scale past 1 ECS task (aka one Docker container), so we can guarantee that if we were to use WebSockets, every client will connect to the same server instance. This knowledge makes Redis entirely unnecessary, leaving us only with Options 2 and 3 to consider.

Given the additional requirement to have other side effects execute when chat messages are sent (ex: send email notification), it was decided that Option 3 is most ideal from a code cleanliness perspective.

[Service sent events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) was also considered as an alternative to WebSockets but eventually decided against. SSE is basically the same as WebSockets, but only works in one direction, sending updates from the server to the client. Chat is inherently bidirectional (client also needs to send messages to the server), so it was decided that it doesn't make sense to only use SSE for receiving messages and then have to implement a separate API endpoint for sending them.

---

## 5. Consequences & Next Steps

### Positive Consequences

Now we have a clear path forward on how we are to implement chat.

### Negative Consequences / Trade-offs

As mentioned above, this does introduce some technical complexity but still maintain that this is the best solution considered from a UX/technical correctness standpoint.

### Action Items

[Issue #58](https://github.com/UTDallasEPICS/ITS/issues/58) will be edited to have more detail on next steps for the implementation and completed in Fall 2026.
