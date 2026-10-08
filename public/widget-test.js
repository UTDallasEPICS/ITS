// 1. Find the <script> tag that loaded this file
const script = document.currentScript

// 2. Read the site tag and derive the ITS API origin from the script URL
const siteTag = script.dataset.siteTag
console.log('[ITS widget] site tag:', siteTag)

const apiBase = new URL(script.src).origin // origin: "http://localhost:3000" 

// 3. Create the launcher button
const button = document.createElement('button')
button.textContent = '?'
button.style.position = 'fixed'
button.style.right = '20px'
button.style.bottom = '20px'
button.style.width = '56px'
button.style.height = '56px'
button.style.borderRadius = '50%'
button.style.background = '#2563eb'
button.style.color = 'white'
button.style.fontSize = '24px'
button.style.border = 'none'

// 4. On click, call the ITS API cross-origin
button.addEventListener('click', async () => {
  console.log('[ITS widget] Button clicked, sending request...')
  try {
    const res = await fetch(`${apiBase}/api/health?siteTag=${siteTag}`)
    const data = await res.json()
    console.log('[ITS widget] Server response:', data)
  } catch (err) {
    console.error('[ITS widget] Request failed:', err)
  }
})

// 5. Attach the button to the host page
document.body.appendChild(button)