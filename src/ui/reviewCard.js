/**
 * ReviewCard - 单条锐评卡片
 * 已移除重写按钮（重写功能移到预览弹窗）
 * 性格标签加了"这只鼠的特质"备注
 */

export class ReviewCard {
  static render(review) {
    const personalityHtml = (review.personality || [])
      .map(p => `<span class="shu-tag">${escapeHtml(p)}</span>`)
      .join('');

    const timeStr = new Date(review.timestamp).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const likedClass = review.liked ? 'active' : '';
    const pinnedClass = review.pinned ? 'active' : '';
    const heartIcon = review.liked ? 'fa-solid' : 'fa-regular';

    // 性格标签区域（加了备注）
    const tagsSection = personalityHtml
      ? `<div class="shu-card-tags">
           <span class="shu-tag-label">🐭 这只鼠的特质</span>
           ${personalityHtml}
         </div>`
      : '';

    // 老大的批注
    let commentHtml = '';
    if (review.ownerComment) {
      commentHtml = `
        <div class="shu-card-comment" data-id="${review.id}">
          <span class="shu-comment-label">💬</span>
          <span class="shu-comment-text">${escapeHtml(review.ownerComment)}</span>
        </div>
      `;
    }

    return `
      <div class="shu-card" data-id="${review.id}">
        <div class="shu-card-header">
          <div class="shu-card-meta">
            <span class="shu-card-character">🎭 ${escapeHtml(review.characterName)}</span>
            <span class="shu-card-time">${timeStr}</span>
            ${review.pinned ? '<span class="shu-card-pin-badge">📌</span>' : ''}
          </div>
          ${tagsSection}
        </div>
        <div class="shu-card-body">${escapeHtml(review.content)}</div>
        ${commentHtml}
        <div class="shu-card-actions">
          <button class="shu-action-btn shu-btn-like ${likedClass}"
            data-action="like" data-id="${review.id}" title="点赞">
            <i class="${heartIcon} fa-heart"></i>
          </button>
          <button class="shu-action-btn shu-btn-pin ${pinnedClass}"
            data-action="pin" data-id="${review.id}" title="置顶">
            <i class="fa-solid fa-thumbtack"></i>
          </button>
          <button class="shu-action-btn shu-btn-comment"
            data-action="comment" data-id="${review.id}" title="写批注">
            <i class="fa-regular fa-comment"></i>
          </button>
          <div style="flex:1;"></div>
          <button class="shu-action-btn shu-btn-delete"
            data-action="delete" data-id="${review.id}" title="撕掉">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}
