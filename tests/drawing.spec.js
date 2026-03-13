const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test('Deve carregar o script e abrir o painel de desenho', async ({ page }) => {
  // Captura logs do console da página
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // Caminho absoluto para o mock HTML
  const mockPath = 'file://' + path.resolve(__dirname, 'mock-page.html');
  await page.goto(mockPath);

  // Lê o conteúdo do script
  const scriptPath = path.resolve(__dirname, '../tecconcursos-desenho.user.js');
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');

  // Injeta o mock da API Tampermonkey
  await page.addScriptTag({ content: 'function GM_addStyle(css) { const style = document.createElement("style"); style.innerHTML = css; document.head.appendChild(style); }' });

  // Injeta o script na página
  await page.addScriptTag({ content: scriptContent });

  // Verifica se o painel apareceu
  const panel = page.locator('#tcc-draw-panel');
  await expect(panel).toBeVisible();

  // Ativa o modo de desenho
  const toggleBtn = page.locator('#tcc-btn-toggle');
  await toggleBtn.click();
  await expect(toggleBtn).toHaveClass(/on/);

  // Verifica se o canvas existe
  const canvas = page.locator('#tcc-draw-canvas');
  await expect(canvas).toBeVisible();

  // Simula um traço no canvas (coordenadas relativas ao canvas)
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Não foi possível obter o boundingBox do canvas');
  }

  await page.mouse.move(canvasBox.x + 50, canvasBox.y + 50);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 150, canvasBox.y + 150);
  await page.mouse.up();

  // Verifica o botão de desfazer (undo)
  const undoBtn = page.locator('#tcc-btn-undo');
  await expect(undoBtn).toBeEnabled();

  // Limpa o canvas
  const clearBtn = page.locator('button:has-text("Limpar")');
  await clearBtn.click();
  
  // O botão de desfazer deve continuar habilitado após limpar
  await expect(undoBtn).toBeEnabled();
  
  // Se desfizer o "Limpar", o desenho deve voltar
  await undoBtn.click();
  await expect(undoBtn).toBeEnabled();
});
