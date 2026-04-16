/**
 * ReviewGenerator -锐评生成器
 * 使用 /gen斜杠命令，在当前聊天环境内生成
 */

export class ReviewGenerator {
  constructor(dependencies) {
    this.executeSlashCommandsWithOptions = dependencies.executeSlashCommandsWithOptions;
    this.getContext = dependencies.getContext;
    this.store = dependencies.store;
  }

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

  async generate() {
    const context = this.getContext();
    if (!context || !context.chat || context.chat.length === 0) {
      throw new Error('没有可用的聊天记录');
    }

    const maxMessages = this.store.getMaxChatMessages();
    const nickname = this.store.getUserNickname();
    const characterName = context.name2|| context.name || '未知角色';

    const recentMessages = this._extractMessages(context.chat, maxMessages, characterName);

    if (recentMessages.length < 2) {
      throw new Error('聊天记录太短了，至少需要几个来回才能写锐评');
    }

    const chatText = recentMessages.join('\n\n');

    // Step 1: 萃取鼠的情绪/写作风格
    const personality = await this._extractPersonality(chatText, characterName);

    // Step 2: 生成锐评（含标题）
    const result = await this._generateReview(
      chatText,
      personality,
      nickname,
      characterName,);

    return {
      personality,
      title: result.title,
      content: result.content,
      characterName,
      chatId: context.chatId || '',
      chatTitle: this._extractChatTitle(context),};
  }

  _extractMessages(chatArray, maxMessages, characterName) {
    return chatArray
      .filter(msg => {
        if (msg.is_system) return false;
        if (!msg.mes || !msg.mes.trim()) return false;
        if (msg.is_hidden) return false;
        return true;
      })
      .slice(-maxMessages)
      .map(msg => {
        const role = msg.is_user ? '用户' : characterName;
        let text = this._cleanMessage(msg.mes);
        if (!text) return null;
        if (text.length > 800) {
          const head = text.slice(0, 400);
          const tail = text.slice(-300);
          text = head + '\n[…中间省略…]\n' + tail;
        }
        return `${role}: ${text}`;
      })
      .filter(Boolean);
  }

  _cleanMessage(rawHtml) {
    if (!rawHtml) return '';
    let text = rawHtml;
    text = text.replace(/<details[^>]*>[\s\S]*?<\/details>/gi, '');
    text = text.replace(/<div class="mes_reasoning[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    text = text.replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, '');
    text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    text = text.replace(/\[OOC:[\s\S]*?\]/gi, '');
    text = text.replace(/\(OOC:[\s\S]*?\)/gi, '');
    text = text.replace(/<[^>]*>/g, '');
    text = text.replace(/&/g, '&');
    text = text.replace(/</g, '<');
    text = text.replace(/>/g, '>');
    text = text.replace(/"/g, '"');
    text = text.replace(/'/g, "'");
    text = text.replace(/ /g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();
    return text;
  }

  /**
   * Step 1: 萃取鼠在这段聊天中的情绪和写作风格
   *注意：这里描述的是"写这段内容的鼠"角色本身的性格
   */
  async _extractPersonality(chatText, characterName) {
    const truncated = chatText.length > 6000
      ? chatText.slice(-6000)
      : chatText;

    const prompt = `阅读以下角色扮演聊天记录。假设有一只鼠鼠全程参与了这段创作过程（写了里面的角色对白和剧情），现在要用3到5个关键词描述这只鼠在写作过程中的情绪状态和风格。

注意：描述的是"写作者（鼠）"角色本身的性格！
比如写虐文的鼠可能是"写嗨了""手在抖""边写边哭"写搞笑的鼠可能是"笑死自己""发癫中""越写越离谱"

要求：
- 只输出关键词，用逗号分隔
- 关键词要生动有画面感（如"写嗨了""手在抖""嘴角压不住""越写越上头""疯狂加戏"）
- 完全基于聊天内容的氛围和走向来推断

聊天记录：
${truncated}

鼠的状态关键词：`;

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
   * Step 2: 生成锐评（含发癫标题）
   * 返回 { title, content }
   */
  async _generateReview(chatText, personality, nickname, characterName) {
    const truncated = chatText.length > 8000
      ? chatText.slice(-8000)
      : chatText;
    const personalityStr = personality.join('、');

    const prompt = `你是一只当前状态为【${personalityStr}】的鼠鼠，刚刚深度参与了一段"${nickname}"和"${characterName}"之间的角色扮演聊天的创作。

现在你要在留言板上留下你对这整段经历的感想。

格式要求（必须严格遵守）：
第一行写一个发癫风格的短标题，格式为【标题：xxx】
然后空一行，写正文。

标题规则：
- 用emoji开头
- 风格参考：颁奖词、热搜标题、弹幕吐槽、玩梗、CP粉发癫、产粮后记等等
- 越离谱越好！但必须跟这段聊天的内容相关
- 示例：
  「标题：🏆 年度最佳反杀奖颁给这位」
  「标题：⚠️ 此聊天的嘴硬浓度已超标300%」
  「标题：📊 老大控场指数：MAX」
  「标题：🔥 写到第三段鼠的键盘已着火」
  「标题：💀鼠做完这单需要缓三天」

正文规则：
- 称呼用户为"${nickname}"或"老大"
- 写3到6句话，要有实质内容
- 结合你对${characterName}这个角色的了解，评价这段聊天的亮点
- 整体评价这段聊天经历，不要只说最后发生了什么
- 可以点评：氛围走向、角色互动亮点、让你印象深刻的细节、转折或名场面、用户的操作风格、设定运用、文笔表现等
- 风格匹配你当前的状态（${personalityStr}）
- 说主复述剧情
- 像是在留言板上随手写的涂鸦
- 禁止使用"作为AI""作为助手"
- 不要用引号包裹全部文字

以下是你刚参与的聊天记录：
${truncated}

你在留言板上写道：`;

    try {
      const raw = await this._callGen(prompt);
      return this._parseReviewOutput(raw);
    } catch (error) {
      console.error('[鼠鼠锐评] 锐评生成失败:', error);
      throw new Error('锐评失败: ' + error.message);
    }
  }

  //========== 工具方法 ==========

  /**
   * 解析锐评输出，分离标题和正文
   */
  _parseReviewOutput(raw) {
    if (!raw) return { title: '', content: '（这只鼠沉默了）' };

    let text = raw.trim();
    // 去掉常见前缀
    text = text.replace(/^(你的|我的)?留言[：:]\s*/i, '');
    text = text.replace(/^(你在留言板上写道|鼠鼠|鼠)[：:]\s*/i, '');

    let title = '';
    let content = text;

    // 尝试提取标题：「标题：xxx」或「标题:xxx」
    const titleMatch = text.match(/^标题[：:]\s*(.+)/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
      // 去掉标题行，剩下的就是正文
      content = text.slice(titleMatch[0].length).trim();
    } else {
      // 如果没有标题格式，看第一行是不是emoji开头的短句（可能AI没严格遵守格式）
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length > 1&& lines[0].length <= 40&& /[\u{1F300}-\u{1FAFF}]/u.test(lines[0])) {
        title = lines[0].trim();
        content = lines.slice(1).join('\n').trim();
      }
    }

    // 清理标题和正文
    title = title.replace(/^["「『""']/g, '').replace(/["」』""']$/g, '');
    content = content.replace(/^["「『""']/g, '').replace(/["」』""']$/g, '');

    return {
      title: title || '',
      content: content || '（这只鼠沉默了）',
    };
  }

  _parseKeywords(raw) {
    if (!raw) return [];
    return raw
      .replace(/^(鼠的状态|性格|状态)?关键词[：:]\s*/i, '')
      .replace(/\n/g, ',')
      .split(/[,，、;；]+/)
      .map(k => k.trim())
      .map(k => k.replace(/^[\d\.\-\*""''「」【】\s]+/, '').trim())
      .filter(k => k.length > 0 && k.length <= 12)
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
