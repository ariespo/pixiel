#!/usr/bin/env node
/**
 * Terminal Care - Setup Script
 * Interactive configuration for first-time setup
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

console.log('============================================');
console.log('  Terminal Care - 初始配置');
console.log('============================================\n');

async function setup() {
  // Check if .env already exists
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const overwrite = await question('.env 文件已存在，是否覆盖? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('配置取消。');
      rl.close();
      return;
    }
  }

  console.log('\n请选择 AI 提供商:\n');
  console.log('1. Google Gemini (默认，推荐)');
  console.log('2. OpenAI / OpenAI 兼容 API');
  console.log('3. 稍后配置\n');

  const choice = await question('选择 (1-3): ');

  let envContent = '# Terminal Care Environment Configuration\n\n';

  if (choice === '1') {
    const apiKey = await question('请输入 Gemini API Key: ');
    envContent += `GEMINI_API_KEY=${apiKey.trim()}\n`;
    envContent += `PORT=3001\n`;
  } else if (choice === '2') {
    const apiUrl = await question('API 地址 (如 https://api.openai.com/v1): ');
    const apiKey = await question('API Key: ');
    const model = await question('模型名称 (如 gpt-4o): ');

    envContent += `# Gemini API Key (留空使用自定义 API)\nGEMINI_API_KEY=\n\n`;
    envContent += `# Custom OpenAI-compatible API\nVITE_API_URL=${apiUrl.trim()}\n`;
    envContent += `VITE_CUSTOM_API_KEY=${apiKey.trim()}\n`;
    envContent += `VITE_CUSTOM_MODEL=${model.trim()}\n`;
    envContent += `PORT=3001\n`;
  } else {
    // Copy example
    const examplePath = path.join(process.cwd(), '.env.example');
    if (fs.existsSync(examplePath)) {
      envContent = fs.readFileSync(examplePath, 'utf-8');
    }
    console.log('\n已创建默认配置文件，请稍后手动编辑 .env 文件');
  }

  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ 配置已保存到 .env 文件\n');

  console.log('============================================');
  console.log('  启动命令:');
  console.log('============================================');
  console.log('\n  npm start       - 开发模式 (推荐)');
  console.log('  npm run deploy  - 生产模式\n');

  rl.close();
}

setup().catch(err => {
  console.error('配置出错:', err);
  rl.close();
  process.exit(1);
});
