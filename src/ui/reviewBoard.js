/**
 * ReviewBoard - 留言板弹窗主体
 */

import { ReviewCard } from './reviewCard.js';

export class ReviewBoard {
  constructor(store, callbacks) {
    this.store = store;
    this.callbacks = callbacks;
    this.$overlay = null;
    this.viewMode = 'timeline';
    this.filter = {};

    const self = this;
    window.__shu_close_board = function () {
      const el = document.getElementById('shu-board-overlay');
      if (el) el.remove();
      if (self.$overlay) {
        try { self.$overlay.remove(); } catch (e) { /*忽略 */ }
        self.$overlay = null;
      }
      try { $(document).off('keydown.shu_board'); } catch (e) { /* 忽略 */ }
    };}

  isOpen() {
    if (this.$overlay) {
      if (!document.getElementById('shu-board-overlay')) {
        this.$overlay = null;
      }
    }
    return !!this.$overlay;
  }

  open() {
    const existing = document.getElementById('shu-board-overlay');
    if (existing) existing.remove();
    this.$overlay = null;

    this._createOverlay();
    this._renderContent();
    this._bindEvents();}

  close() {
    $(document).off('keydown.shu_board');
    if (this.$overlay) {
      try { this.$overlay.remove(); } catch (e) { /* 忽略 */ }
      this.$overlay = null;
    }const el = document.getElementById('shu-board-overlay');
    if (el) el.remove();
  }

  refresh() {
    if (!this.isOpen()) return;
    this._updateCharacterFilter();
    this._renderContent();
  }

  _createOverlay() {
    const charOptions = this._buildCharacterOptions();

    const html = `
      <div id="shu-board-overlay" class="shu-board-overlay">
        <div class="shu-board-container" id="shu-board-container">
          <div class="shu-board-header">
            <div class="shu-board-title">
              <span style="font-size: 1.4em;">🐭</span>
              <h3 style="margin: 0;">留言板</h3>
              <span class="shu-board-count"></span>
            </div>
            <button class="shu-board-close"
              onclick="window.__shu_close_board && window.__shu_close_board()"
              title="关闭">
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
              </button></div>
            <div class="shu-filters">
              <select class="shu-filter-character">
                <option value="">全部角色</option>
                ${charOptions}
              </select>
              <label class="shu-filter-label" title="只看收藏">
                <input type="checkbox" class="shu-filter-pinned" />📌
              </label>
              <label class="shu-filter-label" title="只看点赞">
                <input type="checkbox" class="shu-filter-liked" />❤️
              </label></div>
          </div>
          <div class="shu-board-content"></div>
        </div>
      </div>
    `;

    //★ 修复移动端：先用原生DOM插入，再用jQuery引用，不用fadeIn
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    const overlayEl = wrapper.firstChild;
    document.body.appendChild(overlayEl);

    //强制重排，确保移动端浏览器正确渲染
    overlayEl.offsetHeight;

    this.$overlay = $(overlayEl);

    // 短延迟后添加可见性（用CSS transition代替fadeIn）
    overlayEl.style.opacity = '0';
    overlayEl.style.transition = 'opacity 0.18s ease';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlayEl.style.opacity = '1';
      });
    });
  }

  _renderContent() {
    if (!this.$overlay) return;
    const $content = this.$overlay.find('.shu-board-content');
    const reviews = this.store.getReviews(this.filter);
    const totalCount = this.store.getReviewCount();

    this.$overlay.find('.shu-board-count').text(`${totalCount} 条涂鸦`);

    if (reviews.length === 0) {
      const hasFilter = this.filter.characterName || this.filter.pinnedOnly || this.filter.likedOnly;
      const emptyMsg = hasFilter ? '没有符合筛选条件的锐评' : '墙上还什么都没有呢……';
      const emptyHint = hasFilter ? '试试换个筛选条件？' : '去聊聊天然后点「写锐评」吧！';
      $content.html(`
        <div class="shu-empty-state">
          <div style="font-size: 3em; margin-bottom: 10px;">🐭</div>
          <div>${emptyMsg}</div>
          <div style="margin-top: 5px; font-size: 0.85em; opacity: 0.6;">${emptyHint}</div>
        </div>
      `);
      return;
    }

    if (this.viewMode === 'character') {
      this._renderByCharacter($content, reviews);
    } else {
      this._renderTimeline($content, reviews);
    }
  }

  _renderTimeline($content, reviews) {
    $content.html(reviews.map(r => ReviewCard.render(r)).join(''));
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
      html += `<div class="shu-character-group">
        <div class="shu-group-header">
          <span class="shu-group-name">🎭 ${this._escapeHtml(name)}</span>
          <span class="shu-group-count">${groupReviews.length} 条</span>
        </div>
        ${groupReviews.map(r => ReviewCard.render(r)).join('')}
      </div>`;
    }
    $content.html(html);
  }

  _bindEvents() {
    const self = this;

    // 关闭按钮
    this.$overlay.find('.shu-board-close').on('click touchend', function (e) {
      e.preventDefault();
      e.stopPropagation();
      self.close();
    });

    // 点击背景关闭
    const container = document.getElementById('shu-board-container');
    if (container) {
      container.addEventListener('click', e => e.stopPropagation(), true);
      container.addEventListener('touchend', e => e.stopPropagation(), true);
    }

    const overlay = document.getElementById('shu-board-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => self.close());
      overlay.addEventListener('touchend', (e) => {
        if (e.target === overlay) self.close();
      });
    }

    // ESC
    $(document).off('keydown.shu_board').on('keydown.shu_board', function (e) {
      if (e.key === 'Escape' && self.isOpen()) self.close();
    });

    // 视图切换
    this.$overlay.on('click', '.shu-view-btn', function (e) {
      e.stopPropagation();
      self.viewMode = $(this).data('view');
      self.$overlay.find('.shu-view-btn').removeClass('active');
      $(this).addClass('active');
      self._renderContent();
    });

    // 筛选
    this.$overlay.on('change', '.shu-filter-character', function () {
      self.filter.characterName = $(this).val() || undefined;
      self._renderContent();
    });
    this.$overlay.on('change', '.shu-filter-pinned', function () {
      self.filter.pinnedOnly = $(this).is(':checked') || undefined;
      self._renderContent();
    });
    this.$overlay.on('change', '.shu-filter-liked', function () {
      self.filter.likedOnly = $(this).is(':checked') || undefined;
      self._renderContent();
    });

    // 卡片操作
    this.$overlay.on('click', '.shu-action-btn', function (e) {
      e.stopPropagation();
      const action = $(this).data('action');
      const id = $(this).data('id');

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
      }
    });

    this.$overlay.on('click', '.shu-card-comment', function (e) {
      e.stopPropagation();
      self._showCommentInput($(this).data('id'));
    });
  }

  _showCommentInput(reviewId) {
    const review = this.store.getReviewById(reviewId);
    if (!review) return;

    const $card = this.$overlay.find(`.shu-card[data-id="${reviewId}"]`);
    const $existing = $card.find('.shu-comment-input-wrap');
    if ($existing.length) {
      $existing.find('.shu-comment-input').focus();
      return;
    }

    const inputHtml = `
      <div class="shu-comment-input-wrap">
        <input type="text" class="shu-comment-input text_pole"
          placeholder="写点批注……"
          value="${this._escapeHtml(review.ownerComment || '')}" />
        <button class="shu-comment-save menu_button" title="保存">
          <i class="fa-solid fa-check"></i>
        </button><button class="shu-comment-cancel menu_button" title="取消">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;

    $card.find('.shu-card-actions').before(inputHtml);
    const $input = $card.find('.shu-comment-input');
    $input.focus();
    if (review.ownerComment) $input[0].select();

    const self = this;

    $input.on('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        self._saveComment(reviewId, $input.val());
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        $card.find('.shu-comment-input-wrap').remove();
      }
    });

    $card.find('.shu-comment-save').on('click', function (e) {
      e.stopPropagation();
      self._saveComment(reviewId, $input.val());
    });

    $card.find('.shu-comment-cancel').on('click', function (e) {
      e.stopPropagation();
      $card.find('.shu-comment-input-wrap').remove();
    });
  }

  _saveComment(reviewId, commentText) {
    const trimmed = commentText.trim();
    this.store.setOwnerComment(reviewId, trimmed);
    this.refresh();
    if (trimmed) toastr.info('批注已保存');
  }

  _buildCharacterOptions() {
    return this.store.getCharacterNames()
      .map(name => `<option value="${this._escapeHtml(name)}">${this._escapeHtml(name)}</option>`)
      .join('');
  }

  _updateCharacterFilter() {
    if (!this.$overlay) return;
    const $select = this.$overlay.find('.shu-filter-character');
    const currentVal = $select.val();
    $select.html(`<option value="">全部角色</option>` + this._buildCharacterOptions());
    if (currentVal) $select.val(currentVal);
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
