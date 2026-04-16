/**
 * 鼠鼠锐评留言板 - 主入口
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

// ========== 全局状态 ==========

let store = null;
let generator = null;
let board = null;
let settingsPanel = null;
let isGenerating = false;

// ========== 初始化 ==========

jQuery(async () => {
  try {
    console.log('[鼠鼠锐评] 初始化中...');

    store = new ReviewStore(extension_settings, saveSettingsDebounced);

    generator = new ReviewGenerator({
      executeSlashCommandsWithOptions,
      getContext,
      store,
    });

    settingsPanel = new SettingsPanel(store, {
      onGenerateClick: handleGenerate,
      onOpenBoardClick: handleOpenBoard,
    });
    await settingsPanel.init();

    board = new ReviewBoard(store, {
      onDelete: handleDelete,
      callGenericPopup,
      POPUP_TYPE,
      POPUP_RESULT,
    });

    // 自动提醒
    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
      store.incrementCounter();
      if (store.shouldAutoPrompt()) {
        store.resetCounter();
        showAutoPrompt();
      }
    });

    eventSource.on(event_types.CHAT_CHANGED, () => {
      store.resetCounter();
    });

    console.log(`[鼠鼠锐评] 初始化完成！当前已有${store.getReviewCount()} 条锐评`);

  } catch (error) {
    console.error('[鼠鼠锐评] 初始化失败…:', error);
    toastr.error('锐评留言板初始化失败…: ' + error.message);
  }
});

// ========== 核心操作 ==========

async function handleGenerate() {
  if (isGenerating) {
    toastr.warning('鼠鼠正在写啦，别催！');
    return;
  }

  const chatId = getCurrentChatId();
  if (!chatId) {
    toastr.error('没有打开的聊天！');
    return;
  }

  try {
    isGenerating = true;
    settingsPanel.setGenerating(true);
    toastr.info('🐭酝酿中...', '', { timeOut: 2000 });

    const result = await generator.generate();

    const review = store.addReview({
      ...result,
      mode: 'manual',
    });

    toastr.success('锐评上版啦！');

    if (board.isOpen()) {
      board.refresh();
    }

    // 预览弹窗（含重写按钮）
    await showReviewPreview(review);
    settingsPanel.updateCount();

  } catch (error) {
    console.error('[鼠鼠锐评] 生成失败…:', error);
    toastr.error('锐评失败…: ' + error.message);
  } finally {
    isGenerating = false;
    settingsPanel.setGenerating(false);
  }
}

function handleOpenBoard() {
  board.open();
}

async function handleDelete(reviewId) {
  const confirm = await callGenericPopup(
    '确定要扔掉这条锐评吗？扔了就没了哦w',
    POPUP_TYPE.CONFIRM,
    '',
    { okButton: '扔！', cancelButton: '算了' },
  );

  if (confirm === POPUP_RESULT.AFFIRMATIVE) {
    store.deleteReview(reviewId);
    board.refresh();
    settingsPanel.updateCount();
    toastr.info('锐评已扔掉✨');
  }
}

/**
 * 重写锐评（从预览弹窗触发）
 */
async function handleRewrite(reviewId) {
  if (isGenerating) {
    toastr.warning('鼠鼠这就重做😭');
    return;
  }

  const chatId = getCurrentChatId();
  if (!chatId) {
    toastr.error('没有打开的聊天！');
    return;
  }

  try {
    isGenerating = true;
    toastr.info('鼠鼠正在重做...', '', { timeOut: 2000 });

    const result = await generator.generate();

    store.updateReview(reviewId, {
      personality: result.personality,
      content: result.content,
      timestamp: Date.now(),
    });

    // 拿更新后的review数据
    const updatedReview = store.getReviewById(reviewId);
    toastr.success('锐评已重新出锅！');

    if (board.isOpen()) {
      board.refresh();
    }

    // 重新弹出预览（可以继续重写）
    if (updatedReview) {
      await showReviewPreview(updatedReview);
    }
    settingsPanel.updateCount();

  } catch (error) {
    console.error('[鼠鼠锐评] 重做失败…:', error);
    toastr.error('重做失败…: ' + error.message);
  } finally {
    isGenerating = false;
  }
}

// ========== UI辅助 ==========

async function showReviewPreview(review) {
  const personalityTags = review.personality.map(p => `<span style="
      display: inline-block;
      padding: 2px 8px;
      margin: 0 4px 4px 0;
      border-radius: 10px;
      background: rgba(255,255,255,0.1);
      color: var(--SmartThemeQuoteColor);
      font-size: 0.8em;
    ">${escapeHtml(p)}</span>`)
    .join('');

  //★ 改动：最外层div加了max-height 和 overflow-y
  const html = `
    <div style="text-align: left; padding: 10px; max-height: 60vh; overflow-y: auto;">
      <div style="margin-bottom: 8px; color: var(--SmartThemeQuoteColor); font-size: 0.85em;">
        ✨${escapeHtml(review.characterName)}<span style="margin-left: 8px; opacity: 0.6;">
          ${new Date(review.timestamp).toLocaleString('zh-CN')}
        </span>
      </div>
      <div style="margin-bottom: 4px; font-size: 0.75em; opacity: 0.5;">🐭 这只鼠的特质</div>
      <div style="margin-bottom: 12px;">${personalityTags}</div>
      <div style="
        padding: 15px;
        background: rgba(0,0,0,0.15);
        border-radius: 8px;
        border-left: 3px solid var(--SmartThemeQuoteColor);
        line-height: 1.65;
        white-space: pre-wrap;
        word-break: break-word;
      ">${escapeHtml(review.content)}</div>
    </div>
  `;

  const result = await callGenericPopup(
    html,
    POPUP_TYPE.CONFIRM,
    '',
    { okButton: '好耶！！ ✓', cancelButton: '😡 给我重写！' },);

  if (result !== POPUP_RESULT.AFFIRMATIVE) {
    await handleRewrite(review.id);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}
