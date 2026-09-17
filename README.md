# 踩地雷 Minesweeper

經典踩地雷網頁遊戲，插旗時有粒子爆裂、漣漪與音效特效。

**線上遊玩：** https://zerofourhan.github.io/default-project/

## 玩法

- **左鍵**：翻開格子
- **右鍵**：插旗 / 取消插旗
- **長按（手機）**：插旗
- 也可開啟「🚩 插旗模式」，用單擊插旗

第一次點擊一定安全，不會踩到地雷。

## 功能

- 三種難度：初級 9×9、中級 16×16、高級 30×16
- 插旗特效：粒子爆裂 + 雙層漣漪 + 旗幟彈跳 + 音效
- 首次點擊保護、空白區域自動展開
- 計時器、剩餘地雷計數
- 支援滑鼠與觸控（長按插旗）
- 音效開關

## 本地執行

直接用瀏覽器開啟 `docs/index.html` 即可，無需建置。

或啟動本地伺服器：

```bash
py -m http.server 8000 --directory docs
```

然後開啟 http://localhost:8000

## 專案結構

```
docs/            # 遊戲本體（GitHub Pages 發布來源）
├── index.html
├── style.css
├── game.js
└── favicon.svg
src/             # 其他程式碼（Python / Node 骨架）
tests/
```

## 部署

本專案透過 **GitHub Pages** 發布，來源為 `main` 分支的 `/docs` 目錄。推送到 `main` 後會自動重新建置。

## License

MIT
