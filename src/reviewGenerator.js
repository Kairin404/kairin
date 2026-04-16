/**
 * ReviewGenerator -锐评生成器
 * 两步法：性格萃取 →锐评生成
 * 使用 /gen 斜杠命令，在当前聊天环境内生成（预设/JB/角色卡全部生效）
 */

export class ReviewGenerator {
  constructor(dependencies) {
    this.executeSlashCommandsWithOptions = dependencies.executeSlashCommandsWithOptions;
    this.getContext = dependencies.getContext;
    this.store = dependencies.store;
  }

  /**
   * 通过 /gen 命令后台生成内容
   * 不会在聊天记录中留下痕迹，但完全使用当前预设和角色卡
   * @param {string} prompt - 生成用的提示词
   * @returns {Promise<string>} 生成的文本
   */
  async _callGen(prompt) {
    try {
      const result = await this.executeSlashCommandsWithOptions(`/gen ${prompt}`, {
        handleParserErrors: true,
        handleExecutionErrors: true,
        parserFlags: {},abortController: null,
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
   * @returns {Promise<Object>} { personality, content, characterName, chatId, chatTitle }
   */
  async generate() {
    const context = this.getContext();
    if (!context || !context.chat || context.chat.length === 0) {
      throw new Error('没有可用的聊天记录');
    }

    const maxMessages = this.store.getMaxChatMessages();
    const nickname = this.store.getUserNickname();
    const characterName = context.name2|| context.name || '未知角色';

    // 提取最近的聊天消息（跳过系统消息和空消息）
    const recentMessages = context.chat
      .filter(msg => !msg.is_system && msg.mes && msg.mes.trim())
      .slice(-maxMessages)
      .map(msg => {
        const role = msg.is_user ? '用户' : characterName;
        const text = this._stripHtml(msg.mes).trim();
        return `${role}: ${text}`;
      });

    if (recentMessages.length < 2) {
      throw new Error('聊天记录太短了，至少需要几个来回才能写锐评');
    }

    const chatText = recentMessages.join('\n\n');

    // === Step 1: 性格萃取 ===
    const personality = await this._extractPersonality(chatText);

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
   * Step 1: 萃取当前这只鼠的性格特征
   */
  async _extractPersonality(chatText) {
    // 截断：性格萃取不需要完整上下文，取最近一段就够
    const truncated = chatText.length > 6000
      ? chatText.slice(-6000)
      : chatText;

    const prompt = `根据以下聊天记录中角色的表现，用3到5个简短的关键词概括这个角色在这段对话中的性格特征和情绪基调。

要求：
- 只输出关键词，用逗号分隔，不要有任何其他内容
- 关键词要具体生动（如"话痨""闷骚""阴阳怪气""护犊子"），避免泛泛的词（如"友好""有帮助"）
- 基于角色在对话中的实际表现，不要臆测

聊天记录：
${truncated}

关键词：`;

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
   * Step 2: 用萃取的性格生成锐评内容
   */
  async _generateReview(chatText, personality, nickname, characterName) {
    // 锐评不需要太多上下文，截短一些
    const truncated = chatText.length > 4000
      ? chatText.slice(-4000)
      : chatText;
    const personalityStr = personality.join('、');

    const prompt = `你是一只${personalityStr}的鼠鼠。你刚刚参与了一段和"${nickname}"之间的角色扮演聊天（角色名：${characterName}）。现在你要在一面留言板上涂鸦式地留下你对这段记录的真实感想。

要求：
- 称呼用户为"${nickname}"
- 用1到3句话表达感想
- 风格要匹配你的性格（${personalityStr}），不要端着，怎么舒服怎么来
- 可以吐槽、感慨、撒娇、嘚瑟、发牢骚都行
- 说你自己的主观感受，不要总结剧情
- 不要用引号包裹你的话
- 简短有力，像随手在墙上写的涂鸦

以下是你刚参与的聊天片段（仅作为参考）：
${truncated}

你的留言：`;

    try {
      const raw = await this._callGen(prompt);
      return this._cleanReviewContent(raw);
    } catch (error) {
      console.error('[鼠鼠锐评] 锐评生成失败:', error);
      throw new Error('锐评失败: ' + error.message);
    }
  }

  //========== 工具方法 ==========

  /**
   * 从AI的原始输出中解析性格关键词
   */
  _parseKeywords(raw) {
    if (!raw) return [];
    return raw
      .replace(/^关键词[：:]\s*/i, '')
      .replace(/\n/g, ',')
      .split(/[,，、;；]+/)
      .map(k => k.trim())
      .map(k => k.replace(/^[\d\.\-\*""''「」【】\s]+/, '').trim())
      .filter(k => k.length > 0 && k.length <= 10)
      .slice(0, 5);
  }

  /**
   * 清理锐评内容：去掉AI可能加的前缀、引号等
   */
  _cleanReviewContent(raw) {
    if (!raw) return '（这只鼠沉默了）';
    let content = raw.trim();
    // 去掉常见的AI前缀
    content = content.replace(/^(你的|我的)?留言[：:]\s*/i, '');
    content = content.replace(/^鼠鼠[：:]\s*/i, '');
    content = content.replace(/^["「『""']/g, '');
    content = content.replace(/["」』""']$/g, '');
    return content || '（这只鼠沉默了）';
  }

  /**
   * 从HTML中提取纯文本
   */
  _stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * 从Context中提取一个人类可读的聊天标题
   */
  _extractChatTitle(context) {
    if (!context.chatId) return '未知聊天';
    const parts = context.chatId.split(' - ');
    if (parts.length > 1) {
      return parts.slice(1).join(' - ');
    }
    return context.chatId;
  }
}
