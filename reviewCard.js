/**
 * ReviewCard - 单条锐评卡片组件
 * 纯渲染组件，只负责输出HTML，不持有状态
 */

export class ReviewCard {
  /**
   * 渲染一条锐评卡片
   * @param {Object} review - 锐评数据对象
   * @returns {string} HTML字符串
   */
  static render(review) {
    const personality = review.personality || [];
    const personalityTags = personality
      .map(p => `<span class="shu-tag">${escapeHtml(p)}</span>`)
      .join('');

    // 格式化时间：简洁的月/日 时:分
    const time = new Date(review.timestamp).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',});

    const likeClass = review.liked ? 'shu-btn-active' : '';
    const pinClass = review.pinned ? 'shu-btn-active' : '';
    const pinnedCardClass = review.pinned ? 'shu-pinned' : '';
    const pinBadge = review.pinned ? '<span class="shu-pin-badge">📌</span>' : '';

    // 生成模式标记（手动 vs 自动提醒触发）
    const modeIcon = review.mode === 'auto' ? '🔔' : '';

    // 老大的批注区域
    let commentHtml = '';
    if (review.ownerComment) {
      commentHtml = `
        <div class="shu-owner-comment">
          <span class="shu-owner-comment-label">💬 我的批注：</span>
          <span class="shu-owner-comment-text">${escapeHtml(review.ownerComment)}</span>
        </div>`;
    }

    return `
    <div class="shu-review-card ${pinnedCardClass}" data-review-id="${escapeHtml(review.id)}">
      <!--卡片头部：角色信息 + 性格标签 -->
      <div class="shu-card-header">
        <div class="shu-card-meta">
          <span class="shu-character-name">🎭 ${escapeHtml(review.characterName)}</span>
          <span class="shu-card-time">${time} ${modeIcon}</span>
          ${pinBadge}
        </div>
        <div class="shu-personality-tags">${personalityTags}</div>
      </div>

      <!-- 卡片主体：锐评内容 + 批注 -->
      <div class="shu-card-body">
        <div class="shu-review-content">${escapeHtml(review.content)}</div>
        ${commentHtml}
      </div>

      <!-- 卡片底部：操作按钮 -->
      <div class="shu-card-footer">
        <div class="shu-card-actions">
          <button class="shu-action-btn shu-btn-like ${likeClass}"
                  data-action="like" data-id="${escapeHtml(review.id)}" title="点赞">
            <i class="fa-solid fa-heart"></i>
          </button>
          <button class="shu-action-btn shu-btn-pin ${pinClass}"
                  data-action="pin" data-id="${escapeHtml(review.id)}" title="置顶/取消置顶">
            <i class="fa-solid fa-thumbtack"></i>
          </button>
          <button class="shu-action-btn shu-btn-comment"
                  data-action="comment" data-id="${escapeHtml(review.id)}" title="写批注">
            <i class="fa-solid fa-pen"></i>
          </button><button class="shu-action-btn shu-btn-regen"
                  data-action="regenerate" data-id="${escapeHtml(review.id)}" title="重新生成">
            <i class="fa-solid fa-rotate"></i>
          </button><button class="shu-action-btn shu-btn-delete"
                  data-action="delete" data-id="${escapeHtml(review.id)}" title="撕掉这条">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    </div>`;
  }

  /**
   * 批量渲染锐评列表
   * @param {Array} reviews - 锐评数组
   * @returns {string} HTML字符串
   */
  static renderList(reviews) {
    if (!reviews || reviews.length === 0) return '';
    return reviews.map(r => ReviewCard.render(r)).join('');
  }
}

/**
 * HTML字符转义
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}
