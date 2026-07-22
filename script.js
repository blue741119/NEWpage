const menuButton = document.querySelector('.menu-button');
const siteNav = document.querySelector('.site-nav');

if (menuButton && siteNav) {
  const closeMenu = () => {
    siteNav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  };
  menuButton.addEventListener('click', () => {
    const open = siteNav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  siteNav.addEventListener('click', closeMenu);
  document.addEventListener('click', event => {
    if (!siteNav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeMenu();
      menuButton.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1040) closeMenu();
  });
}

const helloButton = document.querySelector('#hello-button');
const helloResult = document.querySelector('#hello-result');
if (helloButton && helloResult) {
  helloButton.addEventListener('click', () => {
    helloResult.textContent = '成功了！你剛剛用 JavaScript 改變了網頁內容。';
  });
}

document.querySelectorAll('pre').forEach((pre, index) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'code-example';
  const toolbar = document.createElement('div');
  toolbar.className = 'code-toolbar';
  const copyButton = document.createElement('button');
  copyButton.className = 'copy-button';
  copyButton.type = 'button';
  copyButton.textContent = '複製程式碼';
  copyButton.setAttribute('aria-label', `複製第 ${index + 1} 個程式碼範例`);

  pre.parentNode.insertBefore(wrapper, pre);
  wrapper.append(toolbar, pre);
  toolbar.append(copyButton);

  copyButton.addEventListener('click', async () => {
    const code = pre.querySelector('code')?.innerText ?? pre.innerText;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.append(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      copyButton.textContent = '已複製！';
      copyButton.classList.add('copied');
    } catch {
      copyButton.textContent = '複製失敗';
    }
    window.setTimeout(() => {
      copyButton.textContent = '複製程式碼';
      copyButton.classList.remove('copied');
    }, 1600);
  });
});
