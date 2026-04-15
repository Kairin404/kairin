/**
 * ReviewBoard - 留言板弹窗主体
 * 自定义模态框实现，支持内部交互和实时刷新
 */

import { ReviewCard } from './reviewCard.js';

export class ReviewBoard {
  constructor(store, callbacks) {
    this.store = store;
    this.callbacks = callbacks;

    // 弹窗状态
    this._isOpen = false;

    // 视图状态
    this._currentView = 'timeline'; // 'timeline' | 'character'
    this._currentCharacterFilter = '';
    this._showPinnedOnly = false;
  }

  /**
   * 弹窗是否打开
   */
  isOpen() {
    return this._isOpen;
  }

  /**
   * 打开留言板
   */
  open() {
    if (this._isOpen) {
      // 如果已经开着，只刷新内容
      this.refresh();
      return;
    }
    this._isOpen = true;
    this._renderFrame();
    this._renderContent();
    this._bindEvents();
  }

  /**
   * 关闭留言板
   */
  close() {
    $('.shu-board-overlay').remove();
    $(document).off('keydown.shuBoard');
    this._isOpen = false;
  }

  /**
   * 刷新留言板内容（不重建外框）
   */
  refresh() {
    if (!this._isOpen) return;
    this._renderContent();
  }

  //========== 渲染 ==========

  /**
   * 渲染弹窗外框（只在open时调用一次）
   */
  _renderFrame() {
    // 移除可能残留的旧弹窗
    $('.shu-board-overlay').remove();

    // 构建角色筛选下拉框选项
    const characters = this.store.getCharacterNames();
    const characterOptions = characters
      .map(n => `<option value="${this._esc(n)}">${this._esc(n)}</option>`)
      .join('');

    const html = `
    <div class="shu-board-overlay">
      <div class="shu-board-modal">

        <!-- 头部 -->
        <div class="shu-board-header">
          <h3>🐭 鼠鼠锐评留言板</h3>
          <button class="shu-board-close" title="关闭">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- 工具栏 -->
        <div class="shu-board-toolbar">
          <div class="shu-view-tabs">
            <button class="shu-tab-btn shu-tab-active" data-view="timeline">
              <i class="fa-solid fa-clock"></i> 时间线
            </button>
            <button class="shu-tab-btn" data-view="character">
              <i class="fa-solid fa-masks-theater"></i> 按角色
            </button>
          </div>
          <div class="shu-board-filters">
            <select id="shu_filter_character" class="text_pole">
              <option value="">全部角色</option>
              ${characterOptions}
            </select>
            <label class="checkbox_label shu-filter-checkbox">
              <input id="shu_filter_pinned" type="checkbox" />
              <small>只看收藏</small>
            </label>
          </div>
        </div>

        <!-- 内容区（卡片在这里渲染） -->
        <div class="shu-board-content" id="shu_board_content"></div>

        <!-- 底栏 -->
        <div class="shu-board-footer">
          <span class="shu-board-count"></span>
        </div>

      </div>
    </div>`;

    $('body').append(html);}

  /**
   * 渲染内容区域（切换视图、筛选后调用）
   */
  _renderContent() {
    const container = $('#shu_board_content');
    if (!container.length) return;

    // 构建筛选条件
    const filter = {};
    if (this._currentCharacterFilter) {
      filter.characterName = this._currentCharacterFilter;
    }
    if (this._showPinnedOnly) {
      filter.pinnedOnly = true;
    }

    const reviews = this.store.getReviews(filter);

    // 空状态
    if (reviews.length === 0) {
      const emptyHint = this._currentCharacterFilter
        ? '这个角色还没有锐评'
        : '快去让鼠鼠写一条吧！';

      container.html(`
        <div class="shu-empty-state">
          <div style="font-size: 3em; margin-bottom: 12px;">🐭</div>
          <div>留言板上空空如也</div>
          <div style="opacity: 0.6; margin-top: 4px; font-size: 0.9em;">${emptyHint}</div>
        </div>`);
      this._updateFooter(0);
      return;
    }

    // 根据视图模式渲染
    if (this._currentView === 'character') {
      this._renderGroupedView(container, reviews);
    } else {
      this._renderTimelineView(container, reviews);
    }

    this._updateFooter(reviews.length);
  }

  /**
   * 时间线视图：所有锐评按时间倒序平铺
   */
  _renderTimelineView(container, reviews) {
    const cards = ReviewCard.renderList(reviews);
    container.html(`<div class="shu-cards-list">${cards}</div>`);
  }

  /**
   * 分组视图：按角色名分组，可折叠
   */
  _renderGroupedView(container, reviews) {
    // 按角色分组
    const groups = new Map();
    reviews.forEach(r => {
      const name = r.characterName || '未知角色';
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(r);
    });

    let html = '';
    for (const [name, groupReviews] of groups) {
      const cards = ReviewCard.renderList(groupReviews);
      html += `
        <div class="shu-character-group">
          <div class="shu-group-header" data-group="${this._esc(name)}">
            <span class="shu-group-toggle">
              <i class="fa-solid fa-chevron-down"></i>
            </span>
            <span class="shu-group-name">🎭 ${this._esc(name)}</span>
            <span class="shu-group-count">${groupReviews.length} 条</span>
          </div>
          <div class="shu-group-content">
            <div class="shu-cards-list">${cards}</div>
          </div>
        </div>`;
    }

    container.html(html);
  }

  // ========== 事件绑定 ==========

  _bindEvents() {
    const $overlay = $('.shu-board-overlay');

    // ---弹窗控制 ---

    // 关闭按钮
    $overlay.on('click', '.shu-board-close', () => this.close());

    // 点击遮罩层关闭
    $overlay.on('click', (e) => {
      if ($(e.target).hasClass('shu-board-overlay')) {
        this.close();
      }
    });

    // ESC键关闭
    $(document).on('keydown.shuBoard', (e) => {
      if (e.key === 'Escape' && this._isOpen) {
        this.close();
      }
    });

    // --- 视图切换 ---

    $overlay.on('click', '.shu-tab-btn', (e) => {
      const view = $(e.currentTarget).data('view');
      this._currentView = view;

      // 更新tab按钮样式
      $overlay.find('.shu-tab-btn').removeClass('shu-tab-active');
      $(e.currentTarget).addClass('shu-tab-active');

      this._renderContent();
    });

    // --- 筛选 ---

    // 角色筛选下拉框
    $overlay.on('change', '#shu_filter_character', (e) => {
      this._currentCharacterFilter = $(e.target).val();
      this._renderContent();
    });

    // 只看收藏
    $overlay.on('change', '#shu_filter_pinned', (e) => {
      this._showPinnedOnly = $(e.target).is(':checked');
      this._renderContent();
    });

    // --- 分组折叠 ---

    $overlay.on('click', '.shu-group-header', (e) => {
      const $header = $(e.currentTarget);
      const $content = $header.next('.shu-group-content');
      $content.slideToggle(200);
      $header.find('.shu-group-toggle i')
        .toggleClass('fa-chevron-down fa-chevron-right');
    });

    // ---卡片操作 ---

    // 点赞 ❤️
    $overlay.on('click', '[data-action="like"]', (e) => {
      e.stopPropagation();
      const id = $(e.currentTarget).data('id');
      const isLiked = this.store.toggleLike(id);
      $(e.currentTarget).toggleClass('shu-btn-active', isLiked);
    });

    // 置顶📌
    $overlay.on('click', '[data-action="pin"]', (e) => {
      e.stopPropagation();
      const id = $(e.currentTarget).data('id');
      this.store.togglePin(id);// 置顶会改变排序，需要完整刷新
      this.refresh();
    });

    // 写批注 💬
    $overlay.on('click', '[data-action="comment"]', async (e) => {
      e.stopPropagation();
      const id = $(e.currentTarget).data('id');
      const review = this.store.getReviewById(id);
      if (!review) return;

      const result = await this.callbacks.callGenericPopup(
        '写下你的批注（留空则清除已有批注）：',
        this.callbacks.POPUP_TYPE.INPUT,
        review.ownerComment || '',
        { okButton: '保存', cancelButton: '取消' },);

      // INPUT模式：确认返回字符串，取消返回null/false
      if (result === null || result === false) return;

      const comment = String(result).trim();
      this.store.setOwnerComment(id, comment);
      this.refresh();
    });

    // 删除 🗑️
    $overlay.on('click', '[data-action="delete"]', (e) => {
      e.stopPropagation();
      const id = $(e.currentTarget).data('id');
      this.callbacks.onDelete(id);
    });

    // 重新生成 🔄
    $overlay.on('click', '[data-action="regenerate"]', (e) => {
      e.stopPropagation();
      const id = $(e.currentTarget).data('id');
      this.callbacks.onRegenerate(id);
    });
  }

  // ========== 工具 ==========

  _updateFooter(count) {
    $('.shu-board-count').text(`共 ${count} 条锐评`);
  }

  _esc(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }
}
