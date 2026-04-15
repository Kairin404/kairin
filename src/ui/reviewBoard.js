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
    this.filter = {};}

  isOpen() {
    return !!this.$overlay;
  }

  open() {
    if (this.$overlay) {
      this.refresh();
      return;
    }
    this._createOverlay();
    this._renderContent();
    this._bindEvents();
  }

  close() {
    if (this.$overlay) {
      this.$overlay.fadeOut(180, () => {
        this.$overlay.remove();
        this.$overlay = null;
      });
    }
  }

  refresh() {
    if (!this.$overlay) return;
    this._updateCharacterFilter();
    this._renderContent();
  }

  //========== 构建浮层 ==========

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
              </label></div>
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
    // 按角色分组
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
    // 关闭
    this.$overlay.on('click', '.shu-board-close', () => this.close());
    this.$overlay.on('click', (e) => {
      if ($(e.target).hasClass('shu-board-overlay')) this.close();
    });

    // ESC 关闭
    this._escHandler = (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.close();
    };
    $(document).on('keydown.shu_board', this._escHandler);

    // 视图切换
    this.$overlay.on('click', '.shu-view-btn', (e) => {
      const view = $(e.currentTarget).data('view');
      this.viewMode = view;
      this.$overlay.find('.shu-view-btn').removeClass('active');
      $(e.currentTarget).addClass('active');
      this._renderContent();
    });

    // 筛选：角色
    this.$overlay.on('change', '.shu-filter-character', (e) => {
      this.filter.characterName = $(e.target).val() || undefined;
      this._renderContent();
    });

    // 筛选：置顶
    this.$overlay.on('change', '.shu-filter-pinned', (e) => {
      this.filter.pinnedOnly = $(e.target).is(':checked') || undefined;
      this._renderContent();
    });

    // 筛选：点赞
    this.$overlay.on('change', '.shu-filter-liked', (e) => {
      this.filter.likedOnly = $(e.target).is(':checked') || undefined;
      this._renderContent();
    });

    // 卡片操作：统一事件代理
    this.$overlay.on('click', '.shu-action-btn', (e) => {
      e.stopPropagation();
      const $btn = $(e.currentTarget);
      const action = $btn.data('action');
      const id = $btn.data('id');

      switch (action) {
        case 'like':
          this.store.toggleLike(id);
          this.refresh();
          break;
        case 'pin':
          this.store.togglePin(id);
          this.refresh();
          break;
        case 'comment':
          this._showCommentInput(id);
          break;
        case 'delete':
          this.callbacks.onDelete(id);
          break;
        case 'regen':
          this.callbacks.onRegenerate(id);
          break;
      }
    });

    // 点击已有批注 → 编辑
    this.$overlay.on('click', '.shu-card-comment', (e) => {
      const id = $(e.currentTarget).data('id');
      this._showCommentInput(id);
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

    // 插入到操作栏上方
    $card.find('.shu-card-actions').before(inputHtml);
    const $input = $card.find('.shu-comment-input');
    $input.focus();

    // 如果有已有批注，选中全部文字方便修改
    if (review.ownerComment) {
      $input[0].select();
    }

    // Enter = 保存
    $input.on('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._saveComment(reviewId, $input.val());}
      if (e.key === 'Escape') {
        $card.find('.shu-comment-input-wrap').remove();
      }
    });

    // 按钮
    $card.find('.shu-comment-save').on('click', () => {
      this._saveComment(reviewId, $input.val());
    });$card.find('.shu-comment-cancel').on('click', () => {
      $card.find('.shu-comment-input-wrap').remove();
    });
  }

  _saveComment(reviewId, commentText) {
    const trimmed = commentText.trim();
    this.store.setOwnerComment(reviewId, trimmed);
    this.refresh();if (trimmed) {
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
    //恢复之前的选中值（如果还存在的话）
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
