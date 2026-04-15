/**
 * SettingsPanel -扩展栏设置面板
 *插入到酒馆左侧Extensions栏
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
    this._loadSettings();
    this.updateCount();
  }

  _buildHtml() {
    const s = this.store.getSettings();
    return `
      <div id="shu_review_settings" class="extension_container">
        <div class="inline-drawer">
          <div class="inline-drawer-toggle inline-drawer-header">
            <b>🐭 鼠鼠锐评留言板</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down"></div>
          </div><div class="inline-drawer-content" style="display: none;">

            <div style="margin-bottom: 12px; text-align: center;">
              <span style="color: var(--SmartThemeQuoteColor); font-size: 0.9em;">墙上已有 <strong id="shu_review_count">0</strong> 条涂鸦
              </span>
            </div>

            <div class="flex-container" style="gap: 8px; margin-bottom: 15px;">
              <button id="shu_btn_generate" class="menu_button menu_button_icon" title="让当前聊天的鼠鼠写一条锐评">
                <i class="fa-solid fa-pen-nib"></i>
                <span>写锐评</span>
              </button>
              <button id="shu_btn_open_board" class="menu_button menu_button_icon" title="打开留言板">
                <i class="fa-solid fa-clipboard-list"></i>
                <span>留言板</span>
              </button>
            </div>

            <hr><div style="margin-top: 10px;">

              <label for="shu_nickname" style="display: block; margin-bottom: 4px; font-size: 0.85em;">鼠鼠怎么称呼你？
              </label>
              <input id="shu_nickname" type="text" class="text_pole"
                placeholder="留空默认叫你「老大」"
                value="${this._escapeAttr(s.userNickname || '')}"
                style="margin-bottom: 12px;"
              />

              <label for="shu_max_messages" style="display: block; margin-bottom: 4px; font-size: 0.85em;">
                生成锐评时参考最近几条消息
              </label>
              <div class="flex-container" style="align-items: center; gap: 8px; margin-bottom: 12px;">
                <input id="shu_max_messages" type="range" min="5" max="100" step="5"
                  value="${s.maxChatMessages || 30}"
                  style="flex: 1;"
                />
                <span id="shu_max_messages_val" style="min-width: 32px; text-align: center;">
                  ${s.maxChatMessages || 30}
                </span>
              </div>

              <label class="checkbox_label" style="margin-bottom: 8px;">
                <input id="shu_auto_prompt" type="checkbox" ${s.autoPrompt ? 'checked' : ''} />
                <span>自动提醒写锐评</span>
              </label>
              <div id="shu_auto_interval_wrap" style="margin-left: 24px; margin-bottom: 8px; ${s.autoPrompt ? '' : 'display: none;'}">
                <label for="shu_auto_interval" style="font-size: 0.85em;">
                  每收到多少条AI消息后提醒
                </label>
                <div class="flex-container" style="align-items: center; gap: 8px;">
                  <input id="shu_auto_interval" type="range" min="5" max="100" step="5"
                    value="${s.autoPromptInterval || 20}"
                    style="flex: 1;"
                  />
                  <span id="shu_auto_interval_val" style="min-width: 32px; text-align: center;">
                    ${s.autoPromptInterval || 20}
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    $('#shu_btn_generate').on('click', () => this.callbacks.onGenerateClick());
    $('#shu_btn_open_board').on('click', () => this.callbacks.onOpenBoardClick());

    $('#shu_nickname').on('input', (e) => {
      this.store.setUserNickname($(e.target).val().trim());
    });

    $('#shu_max_messages').on('input', (e) => {
      const val = parseInt($(e.target).val());
      $('#shu_max_messages_val').text(val);
      this.store.setMaxChatMessages(val);
    });

    $('#shu_auto_prompt').on('change', (e) => {
      const checked = $(e.target).is(':checked');
      $('#shu_auto_interval_wrap').toggle(checked);
      const currentInterval = this.store.getAutoPromptSettings().interval;
      this.store.setAutoPromptSettings(checked, currentInterval);
    });

    $('#shu_auto_interval').on('input', (e) => {
      const val = parseInt($(e.target).val());
      $('#shu_auto_interval_val').text(val);
      this.store.setAutoPromptSettings(undefined, val);
    });
  }

  _loadSettings() {
    const s = this.store.getSettings();
    $('#shu_nickname').val(s.userNickname || '');
    $('#shu_max_messages').val(s.maxChatMessages || 30);
    $('#shu_max_messages_val').text(s.maxChatMessages || 30);
    $('#shu_auto_prompt').prop('checked', !!s.autoPrompt);
    $('#shu_auto_interval_wrap').toggle(!!s.autoPrompt);
    $('#shu_auto_interval').val(s.autoPromptInterval || 20);
    $('#shu_auto_interval_val').text(s.autoPromptInterval || 20);
  }

  setGenerating(isGenerating) {
    const btn = $('#shu_btn_generate');
    if (isGenerating) {
      btn.prop('disabled', true);
      btn.find('i').removeClass('fa-pen-nib').addClass('fa-spinner fa-spin');
      btn.find('span').text('写ing...');
    } else {
      btn.prop('disabled', false);
      btn.find('i').removeClass('fa-spinner fa-spin').addClass('fa-pen-nib');
      btn.find('span').text('写锐评');
    }
  }

  updateCount() {
    $('#shu_review_count').text(this.store.getReviewCount());
  }

  _escapeAttr(str) {
    return str.replace(/"/g, '"').replace(/</g, '<').replace(/>/g, '>');
  }
}
