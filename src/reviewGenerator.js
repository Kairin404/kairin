/**
 * ReviewGenerator - 锐评生成器
 * 使用 /gen 斜杠命令，在当前聊天环境内生成
 */

export class ReviewGenerator {
  constructor(dependencies) {
    this.executeSlashCommandsWithOptions = dependencies.executeSlashCommandsWithOptions;
    this.getContext = dependencies.getContext;
    this.store = dependencies.store;
  }

  /**
   * 通过 /gen 命令后台生成内容
   * @param {string} prompt - 提示词
   * @returns {Promise<string>} 生成的文本
   */
  async _callGen(prompt) {
    try {
      const result = await this.executeSlashCommandsWithOptions(`/gen ${prompt}`, {
        handleParserErrors: true,
        handleExecutionErrors: true,
        parserFlags: {},
        abortController: null,
      });

      let content = '';

      if (result && typeof result === 'string') {
        content = result;
      } else if (result && result.pipe) {
        content = result.pipe || '';
      } else if (result) {
        content = String(result);
      }

      content = content.trim();

      if (!content) {
        throw new Error('AI返回内容为空');
      }

      return content;
    } catch (error) {
      console.error('[鼠鼠锐评] /gen 命令执行失败:', error);
      throw error;
    }
  }

  /**
   * 主入口：为当前聊天生成一条锐评
   */
  async generate() {
    const context = this.getContext();
    if (!context || !context.chat || context.chat.length === 0) {
      throw new Error('没有可用的聊天记录');
    }

    const maxMessages = this.store.getMaxChatMessages();
    const nickname = this.store.getUserNickname();
    const characterName = context.name2 || context.name || '未知角色';

    // 提取并清理聊天消息
    const recentMessages = this._extractMessages(context.chat, maxMessages, characterName);

    if (recentMessages.length < 2) {
      throw new Error('聊天记录太短了，至少需要几个来回才能写锐评');
    }

    const chatText = recentMessages.join('\n\n');

    // === Step 1: 性格萃取 ===
    const personality = await this._extractPersonality(chatText, characterName);

    // === Step 2: 生成锐评 ===
    const content = await this._generateReview(
      chatText,
      personality,
      nickname,
      characterName,
    );

    return {
      personality,
      content,
      characterName,
      chatId: context.chatId || '',
      chatTitle: this._extractChatTitle(context),
    };
  }

  /**
   * 从聊天记录中提取并清理消息
   * 去掉系统消息、空消息、HTML标签、思维链残留等
   */
  _extractMessages(chatArray, maxMessages, characterName) {
    return chatArray
      .filter(msg => {
        // 跳过系统消息
        if (msg.is_system) return false;
        // 跳过空消息
        if (!msg.mes || !msg.mes.trim()) return false;
        // 跳过隐藏消息（如果有的话）
        if (msg.is_hidden) return false;
        return true;
      })
      .slice(-maxMessages)
      .map(msg => {
        const role = msg.is_user ? '用户' : characterName;
        let text = this._cleanMessage(msg.mes);
        // 如果清理后为空则跳过
        if (!text) return null;
        // 截断单条过长的消息（保留前后各一部分）
        if (text.length > 800) {
          const head = text.slice(0, 400);
          const tail = text.slice(-300);
          text = head + '\n[…中间省略…]\n' + tail;
        }
        return `${role}: ${text}`;
      })
      .filter(Boolean);
  }

  /**
   * 清理单条消息内容
   * 去除HTML、思维链、OOC标记等干扰内容
   */
  _cleanMessage(rawHtml) {
    if (!rawHtml) return '';
    let text = rawHtml;

    // 1. 去掉思维链/推理块（常见格式）
    text = text.replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '');
    text = text.replace(/<div class="mes_reasoning[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    text = text.replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, '');
    text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    // 2. 去掉OOC标记
    text = text.replace(/\[OOC:[\s\S]*?\]/gi, '');
    text = text.replace(/\(OOC:[\s\S]*?\)/gi, '');

    // 3. 去掉所有HTML标签
    text = text.replace(/<[^>]*>/g, '');

    // 4. 解码HTML实体
    text = text.replace(/&/g, '&');
    text = text.replace(/</g, '<');
    text = text.replace(/>/g, '>');
    text = text.replace(/"/g, '"');
    text = text.replace(/'/g, "'");
    text = text.replace(/ /g, ' ');

    // 5. 清理多余空白
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
  }

  /**
   * Step 1: 萃取性格特征
   */
  async _extractPersonality(chatText, characterName) {
    const truncated = chatText.length > 6000
      ? chatText.slice(-6000)
      : chatText;

    const prompt = `阅读以下角色扮演聊天记录，分析"${characterName}"这个角色在对话中展现出的性格特征。

用3到5个简短的中文关键词概括，要求：
- 只输出关键词，用逗号分隔
- 关键词要具体生动鲜明（如"话痨""闷骚""阴阳怪气""护犊子""嘴硬心软"）
- 避免泛泛的词（如"友好""温柔""善良"）
- 完全基于对话中的实际表现

聊天记录：
${truncated}

性格关键词：`;

    try {
      const raw = await this._callGen(prompt);
      const keywords = this._parseKeywords(raw);
      return keywords.length > 0 ? keywords : ['神秘'];
    } catch (error) {
      console.error('[鼠鼠锐评] 性格萃取失败:', error);
      return ['神秘'];
    }
  }

  /**
   * Step 2: 生成锐评内容
   */
  async _generateReview(chatText, personality, nickname, characterName) {
    const truncated = chatText.length > 8000
      ? chatText.slice(-8000)
      : chatText;
    const personalityStr = personality.join('、');

    const prompt = `你是一只性格${personalityStr}的鼠鼠，刚刚深度参与了一段"${nickname}"和"${characterName}"之间的角色扮演聊天。

现在你要在留言板上涂鸦式地写下你对这整段经历的真实感想。

规则：
- 称呼用户为"${nickname}"或"老大"
- 写3到6句话，要有实质内容！
- 你需要整体评价这段聊天经历，不要只说最后一句话发生了什么
- 可以点评：氛围走向、角色互动中的亮点或槽点、让你印象深刻的细节、某个转折或名场面、用户的操作风格等
- 风格必须匹配你的性格（${personalityStr}）！想吐槽就吐槽，想撒娇就撒娇，想阴阳怪气就阴阳怪气
- 说你自己的主观感受和评价，而不是复述剧情
- 像是在留言板上随手写的涂鸦，不要正式、不要端着
- 禁止使用"作为AI""作为助手""作为一个"这类说法
- 不要用引号包裹你的全部文字

以下是你刚参与的聊天记录：
${truncated}

你在留言板上写道：`;

    try {
      const raw = await this._callGen(prompt);
      return this._cleanReviewContent(raw);
    } catch (error) {
      console.error('[鼠鼠锐评] 锐评生成失败:', error);
      throw new Error('锐评失败: ' + error.message);
    }
  }

  // ========== 工具方法 ==========

  _parseKeywords(raw) {
    if (!raw) return [];
    return raw
      .replace(/^(性格)?关键词[：:]\s*/i, '')
      .replace(/\n/g, ',')
      .split(/[,，、;；]+/)
      .map(k => k.trim())
      .map(k => k.replace(/^[\d\.\-\*""''「」【】\s]+/, '').trim())
      .filter(k => k.length > 0 && k.length <= 10)
      .slice(0, 5);
  }

  _cleanReviewContent(raw) {
    if (!raw) return '（这只鼠沉默了）';
    let content = raw.trim();
    content = content.replace(/^(你的|我的)?留言[：:]\s*/i, '');
    content = content.replace(/^(你在留言板上写道|鼠鼠|鼠)[：:]\s*/i, '');
    content = content.replace(/^["「『""']/g, '');
    content = content.replace(/["」』""']$/g, '');
    return content || '（这只鼠沉默了）';
  }

  _stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  }

  _extractChatTitle(context) {
    if (!context.chatId) return '未知聊天';
    const parts = context.chatId.split(' - ');
    if (parts.length > 1) {
      return parts.slice(1).join(' - ');
    }
    return context.chatId;
  }
}
