/**
 * ReviewBoard - 留言板弹窗主体
 * 全屏浮层，展示所有锐评，支持分组、筛选和互动
 */

import { ReviewCard } from './reviewCard.js';

export class ReviewBoard {
  constructor(store, callbacks) {
    this.store = store;
    this.callbacks = callbacks;
    this.$overlay = null;
    this.viewMode = 'timeline';
    this.filter = {};
  }

  isOpen() {
    // 双重检查：引用存在 且 DOM还在文档中
    if (this.$overlay && !$.contains(document.documentElement, this.$overlay[0])) {
      this.$overlay = null;
    }
    return !!this.$overlay;
  }

  open() {
    if (this.$overlay) {
      // 安全检查：如果DOM已经不在文档中，清掉引用重新创建
      if (!$.contains(document.documentElement, this.$overlay[0])) {
        this.$overlay = null;
      } else {
        this.refresh();
        return;
      }
    }
    this._createOverlay();
    this._renderContent();
    this._bindEvents();
  }

  close() {
    // 先解绑全局ESC监听
    $(document).off('keydown.shu_board');

    if (this.$overlay) {
      this.$overlay.remove();
      this.$overlay = null;
    }
  }

  refresh() {
    if (!this.$overlay) return;
    this._updateCharacterFilter();
    this._renderContent();
  }

  // ========== 构建浮层 ==========

  _createOverlay() {
    const charOptions = this._buildCharacterOptions();

    const html = `
      <div class="shu-board-overlay">
        <div class="shu-board-container">

          <div class="shu-board-header">
            <div class="shu-board-title">
              <span style="font-size: 1.4em;">🐭</span>
              <h3 style="margin: 0;">留言板</h3>
              <span class="shu-board-count"></span>
            </div>
            <button class="shu-board-close" title="关闭">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="shu-board-toolbar">
            <div class="shu-view-toggle">
              <button class="shu-view-btn active" data-view="timeline">
                <i class="fa-solid fa-clock"></i> 时间线
              </button>
              <button class="shu-view-btn" data-view="character">
                <i class="fa-solid fa-masks-theater"></i> 按角色
              </button>
            </div>
            <div class="shu-filters">
              <select class="shu-filter-character">
                <option value="">全部角色</option>
                ${charOptions}
              </select>
              <label class="shu-filter-label" title="只看收藏">
                <input type="checkbox" class="shu-filter-pinned" />📌
              </label>
              <label class="shu-filter-label" title="只看点赞">
                <input type="checkbox" class="shu-filter-liked" /> ❤️
              </label>
            </div>
          </div>

          <div class="shu-board-content">
          </div>

        </div>
      </div>
    `;

    this.$overlay = $(html);
    $('body').append(this.$overlay);
    this.$overlay.hide().fadeIn(180);
  }

  // ========== 渲染内容区 ==========

  _renderContent() {
    const $content = this.$overlay.find('.shu-board-content');
    const reviews = this.store.getReviews(this.filter);
    const totalCount = this.store.getReviewCount();

    // 更新计数
    this.$overlay.find('.shu-board-count').text(`${totalCount} 条涂鸦`);

    // 空状态
    if (reviews.length === 0) {
      const hasFilter = this.filter.characterName || this.filter.pinnedOnly || this.filter.likedOnly;
      const emptyMsg = hasFilter
        ? '没有符合筛选条件的锐评'
        : '墙上还什么都没有呢……';
      const emptyHint = hasFilter
        ? '试试换个筛选条件？'
        : '去聊聊天然后点「写锐评」吧！';

      $content.html(`
        <div class="shu-empty-state">
          <div style="font-size: 3em; margin-bottom: 10px;">🐭</div>
          <div>${emptyMsg}</div>
          <div style="margin-top: 5px; font-size: 0.85em; opacity: 0.6;">${emptyHint}</div>
        </div>
      `);
      return;
    }

    // 按模式渲染
    if (this.viewMode === 'character') {
      this._renderByCharacter($content, reviews);
    } else {
      this._renderTimeline($content, reviews);
    }
  }

  _renderTimeline($content, reviews) {
    const cardsHtml = reviews.map(r => ReviewCard.render(r)).join('');
    $content.html(cardsHtml);
  }

  _renderByCharacter($content, reviews) {
    const groups = new Map();
    reviews.forEach(r => {
      const name = r.characterName || '未知角色';
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(r);
    });

    let html = '';
    for (const [name, groupReviews] of groups) {
      html += `<div class="shu-character-group">`;
      html += `
        <div class="shu-group-header">
          <span class="shu-group-name">🎭 ${this._escapeHtml(name)}</span>
          <span class="shu-group-count">${groupReviews.length} 条</span>
        </div>
      `;
      html += groupReviews.map(r => ReviewCard.render(r)).join('');
      html += `</div>`;
    }
    $content.html(html);
  }

  // ========== 事件绑定 ==========

  _bindEvents() {
    const self = this;

    // ===== 关闭相关（三重保险）=====

    // 1. 关闭按钮 — 直接绑定到按钮本身，不依赖事件委托
    this.$overlay.find('.shu-board-close').on('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      self.close();
    });

    // 2. 点击背景关闭 — container 阻止冒泡，overlay 直接关闭
    this.$overlay.find('.shu-board-container').on('click', (e) => {
      e.stopPropagation();
    });
    this.$overlay.on('click', () => {
      self.close();
    });

    // 3. ESC 关闭
    $(document).off('keydown.shu_board').on('keydown.shu_board', (e) => {
      if (e.key === 'Escape' && self.isOpen()) {
        self.close();
      }
    });

    // ===== 视图切换 =====
    this.$overlay.on('click', '.shu-view-btn', (e) => {
      e.stopPropagation();
      const view = $(e.currentTarget).data('view');
      self.viewMode = view;
      self.$overlay.find('.shu-view-btn').removeClass('active');
      $(e.currentTarget).addClass('active');
      self._renderContent();
    });

    // ===== 筛选 =====
    this.$overlay.on('change', '.shu-filter-character', (e) => {
      self.filter.characterName = $(e.target).val() || undefined;
      self._renderContent();
    });

    this.$overlay.on('change', '.shu-filter-pinned', (e) => {
      self.filter.pinnedOnly = $(e.target).is(':checked') || undefined;
      self._renderContent();
    });

    this.$overlay.on('change', '.shu-filter-liked', (e) => {
      self.filter.likedOnly = $(e.target).is(':checked') || undefined;
      self._renderContent();
    });

    // ===== 卡片操作（事件委托）=====
    this.$overlay.on('click', '.shu-action-btn', (e) => {
      e.stopPropagation();
      const $btn = $(e.currentTarget);
      const action = $btn.data('action');
      const id = $btn.data('id');

      switch (action) {
        case 'like':
          self.store.toggleLike(id);
          self.refresh();
          break;
        case 'pin':
          self.store.togglePin(id);
          self.refresh();
          break;
        case 'comment':
          self._showCommentInput(id);
          break;
        case 'delete':
          self.callbacks.onDelete(id);
          break;
        case 'regen':
          self.callbacks.onRegenerate(id);
          break;
      }
    });

    // 点击已有批注 → 编辑
    this.$overlay.on('click', '.shu-card-comment', (e) => {
      e.stopPropagation();
      const id = $(e.currentTarget).data('id');
      self._showCommentInput(id);
    });
  }

  // ========== 批注输入 ==========

  _showCommentInput(reviewId) {
    const review = this.store.getReviewById(reviewId);
    if (!review) return;

    const $card = this.$overlay.find(`.shu-card[data-id="${reviewId}"]`);

    // 如果已打开输入框，聚焦即可
    const $existing = $card.find('.shu-comment-input-wrap');
    if ($existing.length) {
      $existing.find('.shu-comment-input').focus();
      return;
    }

    const inputHtml = `
      <div class="shu-comment-input-wrap">
        <input type="text" class="shu-comment-input text_pole"
          placeholder="写点批注……"
          value="${this._escapeHtml(review.ownerComment || '')}"
        />
        <button class="shu-comment-save menu_button" title="保存">
          <i class="fa-solid fa-check"></i>
        </button>
        <button class="shu-comment-cancel menu_button" title="取消">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;

    $card.find('.shu-card-actions').before(inputHtml);
    const $input = $card.find('.shu-comment-input');
    $input.focus();

    if (review.ownerComment) {
      $input[0].select();
    }

    $input.on('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._saveComment(reviewId, $input.val());
      }
      if (e.key === 'Escape') {
        e.stopPropagation(); // 防止ESC同时关闭留言板
        $card.find('.shu-comment-input-wrap').remove();
      }
    });

    $card.find('.shu-comment-save').on('click', (e) => {
      e.stopPropagation();
      this._saveComment(reviewId, $input.val());
    });

    $card.find('.shu-comment-cancel').on('click', (e) => {
      e.stopPropagation();
      $card.find('.shu-comment-input-wrap').remove();
    });
  }

  _saveComment(reviewId, commentText) {
    const trimmed = commentText.trim();
    this.store.setOwnerComment(reviewId, trimmed);
    this.refresh();
    if (trimmed) {
      toastr.info('批注已保存');
    }
  }

  // ========== 辅助 ==========

  _buildCharacterOptions() {
    return this.store.getCharacterNames()
      .map(name => `<option value="${this._escapeHtml(name)}">${this._escapeHtml(name)}</option>`)
      .join('');
  }

  _updateCharacterFilter() {
    const $select = this.$overlay.find('.shu-filter-character');
    const currentVal = $select.val();
    const options = `<option value="">全部角色</option>` + this._buildCharacterOptions();
    $select.html(options);
    if (currentVal) {
      $select.val(currentVal);
    }
  }

  _escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }
}
