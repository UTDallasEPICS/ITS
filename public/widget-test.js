// 1. 나를 불러온 <script> 태그를 찾는다
const script = document.currentScript

// 2. 그 태그에 적힌 site tag를 읽는다
const siteTag = script.dataset.siteTag
console.log('[ITS widget] site tag:', siteTag)

// 3. 버튼을 만든다
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

// 4. 누르면 알림을 띄운다
button.addEventListener('click', () => {
  console.log('[ITS widget] 버튼 클릭됨!')
})

// 5. 남의 페이지에 붙인다
document.body.appendChild(button)