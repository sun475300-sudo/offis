/**
 * Electron Main Process — Offis Desktop App
 *
 * Vite dev 서버 또는 빌드된 정적 파일을 로드합니다.
 * - 개발 모드: http://localhost:3000 (Vite dev server)
 * - 프로덕션: file://dist/index.html (빌드 결과물)
 */

const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 앱이 이미 실행 중이면 기존 창을 포커스하고 종료
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1200,
    minHeight: 700,
    title: '🏢 PIXEL OFFICE — Multi-Agent System Dashboard',
    backgroundColor: '#080c14',
    // 타이틀바 제거하고 커스텀 프레임 사용
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // 로컬 파일 접근 허용 (파일 첨부 기능)
      webSecurity: !isDev,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false, // 로딩 완료 후 표시
  });

  // 개발 모드: Vite dev server
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // 개발 도구 열기
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // 프로덕션 모드: 빌드된 파일
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // 로딩 완료되면 부드럽게 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 두 번째 인스턴스 실행 시 기존 창 포커스
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();

  // macOS: Dock 클릭으로 재실행
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── 메뉴 설정 ──────────────────────────────────────────────────────────────
const template = [
  {
    label: '앱',
    submenu: [
      { label: '새로고침', accelerator: 'F5', click: () => mainWindow?.reload() },
      { label: '개발자 도구', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() },
      { type: 'separator' },
      { label: '종료', accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4', click: () => app.quit() },
    ],
  },
  {
    label: '뷰',
    submenu: [
      { label: '실제 크기', accelerator: 'Ctrl+0', role: 'resetZoom' },
      { label: '확대', accelerator: 'Ctrl+=', role: 'zoomIn' },
      { label: '축소', accelerator: 'Ctrl+-', role: 'zoomOut' },
      { type: 'separator' },
      { label: '전체화면', accelerator: 'F11', role: 'togglefullscreen' },
    ],
  },
];

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
});

// IPC: 렌더러에서 로컬 파일 경로 요청
ipcMain.handle('get-app-path', () => app.getPath('userData'));
