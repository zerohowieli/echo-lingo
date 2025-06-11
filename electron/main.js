const { app, BrowserWindow, ipcMain, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const url = require('url');
const https = require('https');
const { Buffer } = require('buffer');

// 存储WebDAV文件映射
let webdavFileMap = new Map();
let proxyServer = null;
let proxyPort = 8765; // 默认代理端口

// WebDAV服务器域名到认证信息的映射
let webdavAuthMap = new Map();

// 启动代理服务器
function startProxyServer() {
  if (proxyServer) return; // 如果服务器已经启动，则不再重复启动
  
  proxyServer = http.createServer(async (req, res) => {
    console.log(`Received proxy request: ${req.url}`);
    
    try {
      const parsedUrl = url.parse(req.url);
      const fileId = parsedUrl.pathname.substring(1); // 移除开头的斜杠
      
      console.log(`Looking for file ID: ${fileId}`);
      console.log(`Available file IDs: ${Array.from(webdavFileMap.keys()).join(', ')}`);
      
      if (!webdavFileMap.has(fileId)) {
        console.error(`File ID not found: ${fileId}`);
        res.writeHead(404);
        res.end('File not found');
        return;
      }
      
      const fileInfo = webdavFileMap.get(fileId);
      console.log(`Found file info: ${JSON.stringify({
        filePath: fileInfo.filePath,
        basePath: fileInfo.basePath,
        protocol: fileInfo.protocol,
        server: fileInfo.server,
        port: fileInfo.port,
        contentType: fileInfo.contentType
      })}`);
      
      try {
        // 使用WebDAV客户端库来处理请求，这样可以确保认证和路径处理正确
        const webdav = await import('webdav');
        const { createClient } = webdav;
        
        // 构建WebDAV URL
        const webdavUrl = `${fileInfo.protocol}://${fileInfo.server}:${fileInfo.port}${fileInfo.basePath}`;
        
        console.log(`WebDAV URL: ${webdavUrl}`);
        console.log(`File path: ${fileInfo.filePath}`);
        
        // 创建WebDAV客户端
        const client = createClient(webdavUrl, {
          username: fileInfo.username,
          password: fileInfo.password
        });
        
        // 检查文件是否存在
        try {
          const exists = await client.exists(fileInfo.filePath);
          console.log(`File exists check: ${exists}`);
          
          if (!exists) {
            console.error(`File does not exist: ${fileInfo.filePath}`);
            res.writeHead(404);
            res.end(`File not found on WebDAV server: ${fileInfo.filePath}`);
            return;
          }
        } catch (error) {
          console.error(`Error checking if file exists: ${error.message}`);
        }
        
        // 处理范围请求
        const range = req.headers.range;
        
        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : undefined;
          
          console.log(`Range request: ${start}-${end || 'end'}`);
          
          try {
            // 获取文件信息
            const stat = await client.stat(fileInfo.filePath);
            console.log(`File stats: ${JSON.stringify(stat)}`);
            
            const fileSize = stat.size;
            
            // 计算范围
            const rangeEnd = end !== undefined ? end : fileSize - 1;
            const chunkSize = (rangeEnd - start) + 1;
            
            console.log(`Getting file content range: ${start}-${rangeEnd}/${fileSize}`);
            
            // 获取部分文件内容
            const fileContent = await client.getFileContents(fileInfo.filePath, { 
              format: 'binary',
              range: { start, end: rangeEnd }
            });
            
            console.log(`Received file content chunk: ${fileContent ? fileContent.byteLength : 0} bytes`);
            
            if (!fileContent || fileContent.byteLength === 0) {
              console.error('Received empty file content');
              res.writeHead(500);
              res.end('Received empty file content from WebDAV server');
              return;
            }
            
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${rangeEnd}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize,
              'Content-Type': fileInfo.contentType
            });
            
            res.end(Buffer.from(fileContent));
          } catch (error) {
            console.error('Error handling range request:', error);
            res.writeHead(500);
            res.end(`Error handling range request: ${error.message}`);
          }
        } else {
          // 获取完整文件内容
          try {
            console.log(`Getting full file content: ${fileInfo.filePath}`);
            
            const fileContent = await client.getFileContents(fileInfo.filePath, { format: 'binary' });
            
            console.log(`Received full file content: ${fileContent ? fileContent.byteLength : 0} bytes`);
            
            if (!fileContent || fileContent.byteLength === 0) {
              console.error('Received empty file content');
              res.writeHead(500);
              res.end('Received empty file content from WebDAV server');
              return;
            }
            
            // 获取文件信息
            const stat = await client.stat(fileInfo.filePath);
            const fileSize = stat.size;
            
            console.log(`Sending response: ${fileSize} bytes, ${fileInfo.contentType}`);
            
            res.writeHead(200, {
              'Content-Length': fileSize,
              'Content-Type': fileInfo.contentType,
              'Accept-Ranges': 'bytes'
            });
            
            res.end(Buffer.from(fileContent));
          } catch (error) {
            console.error('Error getting file content:', error);
            res.writeHead(500);
            res.end(`Error getting file content: ${error.message}`);
          }
        }
      } catch (error) {
        console.error('WebDAV client error:', error);
        res.writeHead(500);
        res.end(`WebDAV client error: ${error.message}`);
      }
    } catch (error) {
      console.error('Proxy server error:', error);
      res.writeHead(500);
      res.end(`Internal Server Error: ${error.message}`);
    }
  });
  
  proxyServer.on('error', (err) => {
    console.error('Proxy server error:', err);
    if (err.code === 'EADDRINUSE') {
      // 如果端口被占用，尝试使用另一个端口
      proxyPort++;
      startProxyServer();
    }
  });
}

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
  // 设置WebView安全选项
  const webPreferences = {
    nodeIntegration: false,
    contextIsolation: true,
    webSecurity: false,  // 禁用同源策略，允许跨域请求
    allowRunningInsecureContent: true,  // 允许HTTPS页面加载HTTP内容
    preload: path.join(__dirname, 'preload.js')
  };
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // 隐藏窗口栏
    webPreferences
  });

  const isDev = process.env.NODE_ENV !== 'production';
  
  // 开发环境下连接到Next.js开发服务器
  if (isDev) {
    // 设置referrer策略为no-referrer
    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: ['*://*/*'] },
      (details, callback) => {
        details.requestHeaders['Referrer-Policy'] = 'no-referrer';
        callback({ requestHeaders: details.requestHeaders });
      }
    );
    
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
  
  // 设置WebDAV请求拦截器
  setupWebDAVRequestInterceptor();
}

// 设置WebDAV请求拦截器
function setupWebDAVRequestInterceptor() {
  // 拦截所有网络请求，添加认证头并清理请求头
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*/*'] },
    (details, callback) => {
      const urlObj = new URL(details.url);
      const hostname = urlObj.hostname;
      
      // 检查是否是WebDAV服务器
      if (webdavAuthMap.has(hostname)) {
        const auth = webdavAuthMap.get(hostname);
        
        // 清理请求头，只保留必要的头
        const cleanHeaders = {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'EchoLingo/1.0',
        };
        
        // 如果有Range头，保留它（对视频流很重要）
        if (details.requestHeaders['Range']) {
          cleanHeaders['Range'] = details.requestHeaders['Range'];
        }
        
        // 如果有Accept头，保留它
        if (details.requestHeaders['Accept']) {
          cleanHeaders['Accept'] = details.requestHeaders['Accept'];
        }
        
        // 如果有Content-Type头，保留它
        if (details.requestHeaders['Content-Type']) {
          cleanHeaders['Content-Type'] = details.requestHeaders['Content-Type'];
        }
        
        // 使用干净的请求头替换原始请求头
        details.requestHeaders = cleanHeaders;
      } else {
        // 对于非WebDAV服务器的请求，也移除Referer头
        if (details.requestHeaders['Referer']) {
          delete details.requestHeaders['Referer'];
        }
      }
      
      callback({ requestHeaders: details.requestHeaders });
    }
  );
  
  // 处理响应头，添加CORS头
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['*://*/*'] },
    (details, callback) => {
      const urlObj = new URL(details.url);
      const hostname = urlObj.hostname;
      
      // 检查是否是WebDAV服务器
      if (webdavAuthMap.has(hostname)) {
        // 添加CORS响应头
        details.responseHeaders['Access-Control-Allow-Origin'] = ['*'];
        details.responseHeaders['Access-Control-Allow-Methods'] = ['GET, HEAD, OPTIONS'];
        details.responseHeaders['Access-Control-Allow-Headers'] = ['Authorization, Content-Type, Range'];
        details.responseHeaders['Access-Control-Allow-Credentials'] = ['true'];
        details.responseHeaders['Access-Control-Expose-Headers'] = ['Content-Length, Content-Range, Accept-Ranges'];
        
        // 如果是OPTIONS请求，设置200状态码
        if (details.method === 'OPTIONS') {
          callback({ 
            responseHeaders: details.responseHeaders,
            statusLine: 'HTTP/1.1 200 OK'
          });
          return;
        }
      }
      
      callback({ responseHeaders: details.responseHeaders });
    }
  );
}

// 当Electron准备就绪时创建窗口
app.whenReady().then(() => {
  // 启动代理服务器
  startProxyServer();
  
  // 注册文件协议处理器
  if (process.platform === 'darwin') {
    // 在macOS上，需要特殊处理file://协议
    protocol.registerFileProtocol('file', (request, callback) => {
      const url = request.url.substr(7); // 去掉 'file://' 前缀
      callback({ path: decodeURI(url) });
    });
  }
  
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

// 获取WebDAV目录内容
ipcMain.handle('get-webdav-directory-contents', async (event, path = '/') => {
  try {
    const config = getUserConfig();
    if (!config || !config.webdav) {
      return { success: false, error: '未找到WebDAV配置' };
    }

    const webdav = await import('webdav');
    const { createClient } = webdav;
    
    // 构建WebDAV URL
    const webdavUrl = config.webdav.fullUrl;
    
    // 创建WebDAV客户端
    const client = createClient(webdavUrl, {
      username: config.webdav.username,
      password: config.webdav.password
    });
    
    // 获取目录内容
    const contents = await client.getDirectoryContents(path);
    
    return { 
      success: true, 
      contents: contents.map(item => ({
        filename: item.basename,
        path: item.filename,
        type: item.type,
        size: item.size,
        lastmod: item.lastmod
      }))
    };
  } catch (error) {
    console.error('Error getting WebDAV directory contents:', error);
    return { 
      success: false, 
      error: error.message || '无法获取目录内容'
    };
  }
});

// 获取WebDAV文件URL
ipcMain.handle('get-webdav-file-url', async (event, filePath) => {
  try {
    const config = getUserConfig();
    if (!config || !config.webdav) {
      return { success: false, error: '未找到WebDAV配置' };
    }

    // 构建WebDAV服务器URL
    const serverHost = config.webdav.server;
    
    // 正确编码文件路径：保留/字符，但编码其他特殊字符
    const encodedFilePath = filePath.split('/').map(segment => 
      encodeURIComponent(segment).replace(/%23/g, '#').replace(/%3F/g, '?')
    ).join('/');
    
    const webdavUrl = `${config.webdav.protocol}://${serverHost}:${config.webdav.port}${config.webdav.path}${encodedFilePath}`;
    
    // 存储认证信息
    const authString = Buffer.from(`${config.webdav.username}:${config.webdav.password}`).toString('base64');
    webdavAuthMap.set(serverHost, authString);
        
    // 在返回URL前先测试连接
    try {
      // 创建一个临时请求来测试连接
      const testResult = await new Promise((resolve, reject) => {
        const requestOptions = {
          method: 'HEAD',
          headers: {
            'Authorization': `Basic ${authString}`
          }
        };
        
        const httpModule = config.webdav.protocol === 'https' ? https : http;
        const req = httpModule.request(webdavUrl, requestOptions, (res) => {
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true });
          } else if (res.statusCode === 401) {
            reject(new Error('认证失败，请检查WebDAV用户名和密码'));
          } else if (res.statusCode === 404) {
            reject(new Error(`文件不存在: ${filePath}`));
          } else {
            reject(new Error(`WebDAV服务器返回错误状态码: ${res.statusCode}`));
          }
        });
        
        req.on('error', (err) => {
          console.error('Test connection error:', err);
          reject(new Error(`连接WebDAV服务器失败: ${err.message}`));
        });
        
        req.end();
      });
      
    } catch (testError) {
      console.error('WebDAV connection test failed:', testError);
      return { success: false, error: testError.message };
    }
    
    return { success: true, url: webdavUrl };
  } catch (error) {
    console.error('Error getting WebDAV file URL:', error);
    return { 
      success: false, 
      error: error.message || '无法获取文件'
    };
  }
}); 