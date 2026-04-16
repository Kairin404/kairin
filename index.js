/**
 * 鼠鼠锐评留言板 - 主入口
 * 让不同聊天中的鼠鼠在同一面墙上留下锐评
 */

import {
  eventSource,
  event_types,
  getCurrentChatId,
  saveSettingsDebounced,
} from '../../../../script.js';

import {
  extension_settings,
  getContext,
} from '../../../extensions.js';

import {
  POPUP_TYPE,
  POPUP_RESULT,
  callGenericPopup,
} from '../../../popup.js';

import { executeSlashCommandsWithOptions } from '../../../slash-commands.js';

import { ReviewStore } from './src/reviewStore.js';
import { ReviewGenerator } from './src/reviewGenerator.js';
import { SettingsPanel } from './src/ui/settingsPanel.js';
import { ReviewBoard } from './src/ui/reviewBoard.js';

//========== 全局状态 ==========

let store = null;
let generator = null;
let board = null;
let settingsPanel = null;
let isGenerating = false;

//========== 初始化 ==========

jQuery(async () => {
  try {
    console.log('[鼠鼠锐评] 初始化中...');

    // 1. 数据层
    store = new ReviewStore(extension_settings, saveSettingsDebounced);

    // 2. 生成器 — 传入 executeSlashCommandsWithOptions
    generator = new ReviewGenerator({
      executeSlashCommandsWithOptions,
      getContext,
      store,
    });

    // 3. 设置面板（插入到Extensions栏）
    settingsPanel = new SettingsPanel(store, {
      onGenerateClick: handleGenerate,
      onOpenBoardClick: handleOpenBoard,});
    await settingsPanel.init();

    // 4. 留言板（弹窗式）
    board = new ReviewBoard(store, {
      onDelete: handleDelete,
      onRegenerate: handleRegenerate,
      callGenericPopup,
      POPUP_TYPE,
      POPUP_RESULT,
    });

    // 5. 事件监听

    // 自动提醒：收到AI消息时计数
    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
      store.incrementCounter();
      if (store.shouldAutoPrompt()) {
        store.resetCounter();
        showAutoPrompt();
      }
    });

    // 切换聊天时重置计数器
    eventSource.on(event_types.CHAT_CHANGED, () => {
      store.resetCounter();
    });

    console.log(`[鼠鼠锐评] 初始化完成！已有${store.getReviewCount()} 条锐评`);

  } catch (error) {
    console.error('[鼠鼠锐评] 初始化失败:', error);
    toastr.error('鼠鼠锐评留言板初始化失败: ' + error.message);
  }
});

// ========== 核心操作 ==========

/**
 * 生成锐评
 */
async function handleGenerate() {
  if (isGenerating) {
    toastr.warning('鼠鼠正在写，别催！');
    return;
  }

  const chatId = getCurrentChatId();
  if (!chatId) {
    toastr.error('没有打开的聊天');
    return;
  }

  try {
    isGenerating = true;
    settingsPanel.setGenerating(true);
    toastr.info('鼠鼠正在酝酿锐评...', '', { timeOut: 2000 });

    const result = await generator.generate();

    const review = store.addReview({
      ...result,
      mode: 'manual',
    });

    toastr.success('锐评已上墙！');

    // 如果留言板开着，刷新它
    if (board.isOpen()) {
      board.refresh();
    }

    // 弹窗预览新锐评
    await showReviewPreview(review);settingsPanel.updateCount();

  } catch (error) {
    console.error('[鼠鼠锐评] 生成失败:', error);
    toastr.error('锐评生成失败: ' + error.message);
  } finally {
    isGenerating = false;
    settingsPanel.setGenerating(false);
  }
}

/**
 * 打开留言板
 */
function handleOpenBoard() {
  board.open();
}

/**
 * 删除锐评
 */
async function handleDelete(reviewId) {
  const confirm = await callGenericPopup(
    '确定要撕掉这条锐评吗？撕了就没了哦。',
    POPUP_TYPE.CONFIRM,
    '',
    { okButton: '撕掉', cancelButton: '算了' },
  );

  if (confirm === POPUP_RESULT.AFFIRMATIVE) {
    store.deleteReview(reviewId);
    board.refresh();
    settingsPanel.updateCount();
    toastr.info('锐评已撕掉');
  }
}

/**
 * 重新生成锐评
 * 注意：使用当前聊天的上下文重新生成，而非原始聊天
 */
async function handleRegenerate(reviewId) {
  if (isGenerating) {
    toastr.warning('鼠鼠正在写，别催！');
    return;
  }

  const chatId = getCurrentChatId();
  if (!chatId) {
    toastr.error('没有打开的聊天');
    return;
  }

  const oldReview = store.getReviewById(reviewId);
  if (!oldReview) return;

  try {
    isGenerating = true;
    toastr.info('鼠鼠正在重写...', '', { timeOut: 2000 });

    const result = await generator.generate();

    store.updateReview(reviewId, {
      personality: result.personality,
      content: result.content,
      timestamp: Date.now(),
    });

    toastr.success('锐评已重写！');
    board.refresh();
  } catch (error) {
    console.error('[鼠鼠锐评] 重写失败:', error);
    toastr.error('重写失败: ' + error.message);
  } finally {
    isGenerating = false;}
}

// ========== UI辅助 ==========

/**
 * 自动提醒弹窗
 */
async function showAutoPrompt() {
  const html = `
    <div style="text-align: center; padding: 10px;">
      <div style="font-size: 2.5em; margin-bottom: 8px;">🐭</div>
      <div>鼠鼠探头：聊了这么久了，</div>
      <div>要不要让鼠在留言板上写点什么？</div></div>
  `;

  const confirm = await callGenericPopup(
    html,
    POPUP_TYPE.CONFIRM,
    '',
    { okButton: '写！', cancelButton: '下次吧' },
  );

  if (confirm === POPUP_RESULT.AFFIRMATIVE) {
    await handleGenerate();
  }
}

/**
 * 锐评预览弹窗（生成成功后展示）
 */
async function showReviewPreview(review) {
  const personalityTags = review.personality
    .map(p => `<span style="
      display: inline-block;
      padding: 2px 8px;
      margin: 0 4px 4px 0;
      border-radius: 10px;
      background: rgba(255,255,255,0.1);
      color: var(--SmartThemeQuoteColor);
      font-size: 0.8em;
    ">${escapeHtml(p)}</span>`)
    .join('');

  const html = `
    <div style="text-align: left; padding: 10px;">
      <div style="margin-bottom: 8px; color: var(--SmartThemeQuoteColor); font-size: 0.85em;">
        🎭${escapeHtml(review.characterName)}<span style="margin-left: 8px; opacity: 0.6;">
          ${new Date(review.timestamp).toLocaleString('zh-CN')}
        </span>
      </div>
      <div style="margin-bottom: 12px;">${personalityTags}</div>
      <div style="
        padding: 15px;
        background: rgba(0,0,0,0.15);
        border-radius: 8px;
        border-left: 3px solid var(--SmartThemeQuoteColor);
        line-height: 1.65;
      ">${escapeHtml(review.content)}</div>
    </div>
  `;

  await callGenericPopup(html, POPUP_TYPE.TEXT, '', { okButton: '好耶' });
}

/**
 * HTML转义
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}
