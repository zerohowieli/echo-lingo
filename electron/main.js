const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 密钥和初始化向量文件路径
const KEYS_PATH = path.join(app.getPath('userData'), 'encryption-keys.json');

// 获取或创建加密密钥和初始化向量
function getOrCreateEncryptionKeys() {
  try {
    // 尝试读取现有的密钥
    if (fs.existsSync(KEYS_PATH)) {
      const keysData = fs.readFileSync(KEYS_PATH, 'utf8');
      const keys = JSON.parse(keysData);
      return {
        key: Buffer.from(keys.key, 'hex'),
        iv: Buffer.from(keys.iv, 'hex')
      };
    }
    
    // 如果不存在，创建新的密钥
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    
    // 保存密钥
    fs.writeFileSync(KEYS_PATH, JSON.stringify({
      key: key.toString('hex'),
      iv: iv.toString('hex')
    }));
    
    return { key, iv };
  } catch (error) {
    console.error('Error handling encryption keys:', error);
    // 如果出错，返回临时密钥（这种情况下配置将不能跨会话保存）
    return {
      key: crypto.randomBytes(32),
      iv: crypto.randomBytes(16)
    };
  }
}

// 获取加密密钥和初始化向量
const { key: ENCRYPTION_KEY, iv: IV } = getOrCreateEncryptionKeys();

// 用户配置文件路径
const USER_CONFIG_PATH = path.join(app.getPath('userData'), 'user-config.json');

// 加密函数
function encrypt(text) {
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// 解密函数
function decrypt(encrypted) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// 保存用户配置
function saveUserConfig(config) {
  const encryptedConfig = encrypt(JSON.stringify(config));
  fs.writeFileSync(USER_CONFIG_PATH, encryptedConfig);
}

// 读取用户配置
function getUserConfig() {
  if (!fs.existsSync(USER_CONFIG_PATH)) {
    return null;
  }
  try {
    const encryptedConfig = fs.readFileSync(USER_CONFIG_PATH, 'utf8');
    const decryptedConfig = decrypt(encryptedConfig);
    return JSON.parse(decryptedConfig);
  } catch (error) {
    console.error('Error reading user config:', error);
    return null;
  }
}

// 保存主窗口引用
let mainWindow;

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // 隐藏窗口栏
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const isDev = process.env.NODE_ENV !== 'production';
  
  // 开发环境下连接到Next.js开发服务器
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境下加载构建后的应用
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  // 监听窗口最大化状态变化
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximize-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximize-change', false);
  });
}

// 当Electron准备就绪时创建窗口
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // 在macOS上，当点击dock图标且没有其他窗口打开时，通常会在应用程序中重新创建一个窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// 处理窗口控制相关的IPC消息
ipcMain.on('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-toggle-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// 处理IPC通信
ipcMain.handle('save-webdav-config', async (event, config) => {
  try {
    // 构建WebDAV完整URL
    const webdavConfig = {
      ...config,
      fullUrl: `${config.protocol}://${config.server}:${config.port}${config.path}`
    };
    
    saveUserConfig({ webdav: webdavConfig });
    return { success: true };
  } catch (error) {
    console.error('Error saving WebDAV config:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-webdav-config', async () => {
  try {
    const config = getUserConfig();
    return config ? config.webdav : null;
  } catch (error) {
    console.error('Error getting WebDAV config:', error);
    return null;
  }
});

// 测试 WebDAV 连接
ipcMain.handle('test-webdav-connection', async (event, config) => {
  try {
    // 使用动态导入替代 require
    const webdav = await import('webdav');
    const { createClient } = webdav;
    
    // 构建 WebDAV URL
    const webdavUrl = `${config.protocol}://${config.server}:${config.port}${config.path}`;
    
    // 创建 WebDAV 客户端
    const client = createClient(webdavUrl, {
      username: config.username,
      password: config.password
    });
    
    // 尝试获取目录内容来测试连接
    await client.getDirectoryContents('/');
    
    return { success: true };
  } catch (error) {
    console.error('WebDAV connection test failed:', error);
    return { 
      success: false, 
      error: error.message || '连接失败，请检查配置'
    };
  }
}); 