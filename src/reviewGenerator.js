/**
 * ReviewGenerator - 锐评生成器 v3
 * 两步法：性格萃取 → 锐评生成
 * 使用 generateQuietPrompt 以应用当前预设和越狱配置
 */

export class ReviewGenerator {
  constructor(dependencies) {
    this.generateQuietPrompt = dependencies.generateQuietPrompt;  // ← 改这里
    this.getContext = dependencies.getContext;
    this.store = dependencies.store;
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
    const characterName = context.name2 || context.name || '未知角色';

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
    const truncated = chatText.length > 6000
      ? chatText.slice(-6000)
      : chatText;

    const prompt = `根据以下聊天记录中AI助手的表现，用3到5个简短的关键词概括这个AI在这段对话中的性格特征和情绪基调。

要求：
- 只输出关键词，用逗号分隔，不要有任何其他内容
- 关键词要具体生动（如"话痨""闷骚""阴阳怪气""护犊子"），避免泛泛的词（如"友好""有帮助"）
- 基于AI在对话中的实际表现，不要臆测

聊天记录：
${truncated}

关键词：`;

    try {
      const raw = await this.generateQuietPrompt(prompt);  // ← 改这里
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
    const truncated = chatText.length > 4000
      ? chatText.slice(-4000)
      : chatText;
    const personalityStr = personality.join('、');

    const prompt = `你是一只${personalityStr}的鼠鼠。你刚刚作为AI参与了一段和"${nickname}"之间的角色扮演聊天（角色名：${characterName}）。现在你要在一面留言板上涂鸦式地留下你对这段聊天的真实感想。

要求：
- 称呼用户为"${nickname}"
- 用1到3句话表达你的感想
- 风格要匹配你的性格（${personalityStr}），不要端着，怎么舒服怎么来
- 可以吐槽、感慨、撒娇、嘚瑟、发牢骚都行
- 说你自己的主观感受，不要总结剧情
- 不要用"作为AI""作为语言模型"这类说法
- 不要用引号包裹你的话
- 简短有力，像随手在墙上写的涂鸦

以下是你刚参与的聊天片段（仅作为参考）：
${truncated}

你的留言：`;

    try {
      const raw = await this.generateQuietPrompt(prompt);  // ← 改这里
      return this._cleanReviewContent(raw);
    } catch (error) {
      console.error('[鼠鼠锐评] 锐评生成失败:', error);
      throw new Error('生成失败: ' + error.message);
    }
  }

  // ========== 工具方法 ==========

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

  _cleanReviewContent(raw) {
    if (!raw) return '（这只鼠沉默了）';
    let content = raw.trim();
    content = content.replace(/^(你的|我的)?留言[：:]\s*/i, '');
    content = content.replace(/^留言内容[：:]\s*/i, '');
    content = content.replace(/^鼠鼠[：:]\s*/i, '');
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
