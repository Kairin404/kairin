/**
 *鼠鼠锐评留言板 - 主入口
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

import {POPUP_TYPE,
  POPUP_RESULT,
  callGenericPopup,
} from '../../../popup.js';

import { executeSlashCommandsWithOptions } from '../../../slash-commands.js';

import { ReviewStore } from './src/reviewStore.js';
import { ReviewGenerator } from './src/reviewGenerator.js';
import { SettingsPanel } from './src/ui/settingsPanel.js';
import { ReviewBoard } from './src/ui/reviewBoard.js';

let store = null;
let generator = null;
let board = null;
let settingsPanel = null;
let isGenerating = false;

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
      onOpenBoardClick: handleOpenBoard,});
    await settingsPanel.init();

    board = new ReviewBoard(store, {
      onDelete: handleDelete,
      callGenericPopup,
      POPUP_TYPE,
      POPUP_RESULT,
    });

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

    console.log(`[鼠鼠锐评] 初始化完成！已有${store.getReviewCount()} 条锐评`);

  } catch (error) {
    console.error('[鼠鼠锐评] 初始化失败:', error);toastr.error('鼠鼠锐评留言板初始化失败: ' + error.message);
  }
});

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

    if (board.isOpen()) {
      board.refresh();
    }

    await showReviewPreview(review);settingsPanel.updateCount();

  } catch (error) {
    console.error('[鼠鼠锐评] 生成失败:', error);
    toastr.error('锐评生成失败: ' + error.message);
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

async function handleRewrite(reviewId) {
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
    toastr.info('鼠鼠正在重写...', '', { timeOut: 2000 });

    const result = await generator.generate();

    store.updateReview(reviewId, {
      personality: result.personality,
      title: result.title,
      content: result.content,
      timestamp: Date.now(),
    });

    const updatedReview = store.getReviewById(reviewId);
    toastr.success('锐评已重写！');

    if (board.isOpen()) {
      board.refresh();
    }

    if (updatedReview) {
      await showReviewPreview(updatedReview);
    }settingsPanel.updateCount();

  } catch (error) {
    console.error('[鼠鼠锐评] 重写失败:', error);
    toastr.error('重写失败: ' + error.message);
  } finally {
    isGenerating = false;}
}

async function showAutoPrompt() {
  const html = `
    <div style="text-align: center; padding: 10px;">
      <div style="font-size: 2.5em; margin-bottom: 8px;">🐭</div>
      <div>鼠鼠探头：聊了这么久了，</div>
      <div>要不要让鼠在留言板上写点什么？</div>
    </div>
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

  // 标题区域
  const titleHtml = review.title
    ? `<div style="
        margin-bottom: 12px;
        font-size: 1.05em;
        font-weight: 600;
        color: var(--SmartThemeQuoteColor);
        line-height: 1.4;
      ">${escapeHtml(review.title)}</div>`
    : '';

  const html = `
    <div style="text-align: left; padding: 10px; max-height: 60vh; overflow-y: auto; -webkit-overflow-scrolling: touch;">
      <div style="margin-bottom: 8px; color: var(--SmartThemeQuoteColor); font-size: 0.85em;">
        🎭 ${escapeHtml(review.characterName)}
        <span style="margin-left: 8px; opacity: 0.6;">
          ${new Date(review.timestamp).toLocaleString('zh-CN')}
        </span>
      </div>
      <div style="margin-bottom: 4px; font-size: 0.75em; opacity: 0.5;">🐭 这只鼠的状态</div>
      <div style="margin-bottom: 12px;">${personalityTags}</div>
      ${titleHtml}
      <div style="
        padding: 15px;
        background: rgba(0,0,0,0.15);
        border-radius: 8px;
        border-left: 3px solid var(--SmartThemeQuoteColor);
        line-height: 1.65;
        white-space: pre-wrap;word-break: break-word;
      ">${escapeHtml(review.content)}</div>
    </div>
  `;

  const result = await callGenericPopup(
    html,
    POPUP_TYPE.CONFIRM,
    '',
    { okButton: '好耶 ✓', cancelButton: '🔄 重写' },
  );

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
