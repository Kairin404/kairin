/**
 * SettingsPanel -扩展栏设置面板
 *插入到SillyTavern的Extensions设置区域
 */

export class SettingsPanel {
  constructor(store, callbacks) {
    this.store = store;
    this.callbacks = callbacks;
  }

  async init() {
    const html = this._buildHtml();
    $('#extensions_settings2').append(html);
    this._bindEvents();
    this.updateCount();
  }

  _buildHtml() {
    const s = this.store.getSettings();
    const nickname = s.userNickname || '';
    const maxMsg = s.maxChatMessages || 30;
    const autoEnabled = s.autoPrompt ? 'checked' : '';
    const autoInterval = s.autoPromptInterval || 20;

    return `
    <div id="shu_review_container" class="extension_container">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>🐭 鼠鼠锐评留言板</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down"></div>
        </div>
        <div class="inline-drawer-content">

          <!-- 统计 -->
          <div class="shu-review-stats">
            <span>📝 留言板上已有 <b id="shu_review_count">0</b> 条锐评</span>
          </div>

          <!-- 操作按钮 -->
          <div class="flex-container" style="gap: 8px; margin-bottom: 12px;">
            <button id="shu_btn_generate" class="menu_button menu_button_icon">
              <i class="fa-solid fa-pen-fancy"></i>
              <span>让鼠鼠写锐评</span>
            </button>
            <button id="shu_btn_open_board" class="menu_button menu_button_icon">
              <i class="fa-solid fa-clipboard-list"></i>
              <span>打开留言板</span>
            </button></div>

          <hr>

          <!-- 称呼设置 -->
          <div style="margin-top: 10px;">
            <label for="shu_nickname">
              <small>鼠鼠怎么称呼你？（留空默认叫"老大"）</small>
            </label>
            <input id="shu_nickname" type="text" class="text_pole"
                   value="${this._escape(nickname)}"
                   placeholder="老大" />
          </div>

          <!-- 参考消息数 -->
          <div style="margin-top: 10px;">
            <label>
              <small>每次锐评参考最近多少条消息</small>
            </label>
            <div class="flex-container" style="align-items: center; gap: 8px;">
              <input id="shu_max_messages" type="range" min="5" max="100" value="${maxMsg}" style="flex: 1;" />
              <span id="shu_max_messages_val" style="min-width: 28px; text-align: center;">${maxMsg}</span>
            </div>
          </div><hr>

          <!-- 自动提醒 -->
          <div style="margin-top: 10px;">
            <label class="checkbox_label">
              <input id="shu_auto_prompt" type="checkbox" ${autoEnabled} />
              <small>自动提醒（每N条AI消息后弹窗问要不要写锐评）</small>
            </label>
          </div>

          <div id="shu_auto_interval_row" style="margin-top: 8px; ${autoEnabled ? '' : 'display: none;'}">
            <label>
              <small>提醒间隔（条）</small>
            </label>
            <div class="flex-container" style="align-items: center; gap: 8px;">
              <input id="shu_auto_interval" type="range" min="5" max="200" value="${autoInterval}" style="flex: 1;" />
              <span id="shu_auto_interval_val" style="min-width: 28px; text-align: center;">${autoInterval}</span>
            </div>
          </div>

        </div>
      </div>
    </div>`;
  }

  _bindEvents() {
    // 生成按钮
    $('#shu_btn_generate').on('click', () => this.callbacks.onGenerateClick());

    // 打开留言板
    $('#shu_btn_open_board').on('click', () => this.callbacks.onOpenBoardClick());

    // 昵称输入
    $('#shu_nickname').on('input', (e) => {
      this.store.setUserNickname($(e.target).val().trim());
    });

    // 消息数滑块
    $('#shu_max_messages').on('input', (e) => {
      const val = parseInt($(e.target).val());
      $('#shu_max_messages_val').text(val);
      this.store.setMaxChatMessages(val);
    });

    // 自动提醒开关
    $('#shu_auto_prompt').on('change', (e) => {
      const checked = $(e.target).is(':checked');
      this.store.setAutoPromptSettings(checked);
      if (checked) {
        $('#shu_auto_interval_row').slideDown(200);
      } else {
        $('#shu_auto_interval_row').slideUp(200);
      }
    });

    // 提醒间隔滑块
    $('#shu_auto_interval').on('input', (e) => {
      const val = parseInt($(e.target).val());
      $('#shu_auto_interval_val').text(val);
      this.store.setAutoPromptSettings(true, val);
    });
  }

  /**
   * 更新锐评计数显示
   */
  updateCount() {
    $('#shu_review_count').text(this.store.getReviewCount());
  }

  /**
   * 切换生成按钮的加载状态
   */
  setGenerating(isGenerating) {
    const btn = $('#shu_btn_generate');
    if (isGenerating) {
      btn.prop('disabled', true);
      btn.find('span').text('鼠鼠在写...');
      btn.find('i').removeClass('fa-pen-fancy').addClass('fa-spinner fa-spin');
    } else {
      btn.prop('disabled', false);
      btn.find('span').text('让鼠鼠写锐评');
      btn.find('i').removeClass('fa-spinner fa-spin').addClass('fa-pen-fancy');
    }
  }

  _escape(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&')
      .replace(/"/g, '"')
      .replace(/</g, '<')
      .replace(/>/g, '>');
  }
}
