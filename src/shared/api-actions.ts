export type ApiActionMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export type ApiActionDescriptor = {
  path: string
  method: ApiActionMethod
}

// Helper for admin endpoints that now live under Hono (no longer React Router
// resource routes, so they skip the `api/actions/<domain>/<name>` assertion).
function adminAction<const M extends ApiActionMethod>(path: `api/admin/${string}`, method: M) {
  return { path: `/${path}` as const, method }
}

export const API_ACTIONS = {
  admin: {
    listUsers: adminAction('api/admin/listUsers', 'GET'),
    getUser: adminAction('api/admin/getUser', 'POST'),
    softDeleteUser: adminAction('api/admin/softDeleteUser', 'DELETE'),
    restoreUser: adminAction('api/admin/restoreUser', 'POST'),
    muteUser: adminAction('api/admin/muteUser', 'PATCH'),
    bulkApproveUserComments: adminAction('api/admin/bulkApproveUserComments', 'POST'),
    bulkSoftDeleteUserComments: adminAction('api/admin/bulkSoftDeleteUserComments', 'DELETE'),
    getSettings: adminAction('api/admin/getSettings', 'GET'),
    updateSettings: adminAction('api/admin/updateSettings', 'PATCH'),
    getCacheStats: adminAction('api/admin/getCacheStats', 'GET'),
    clearCache: adminAction('api/admin/clearCache', 'POST'),
    sendTestMail: adminAction('api/admin/sendTestMail', 'POST'),
    listFriends: adminAction('api/admin/listFriends', 'GET'),
    upsertFriend: adminAction('api/admin/upsertFriend', 'POST'),
    deleteFriend: adminAction('api/admin/deleteFriend', 'DELETE'),
    listCategories: adminAction('api/admin/listCategories', 'GET'),
    upsertCategory: adminAction('api/admin/upsertCategory', 'POST'),
    deleteCategory: adminAction('api/admin/deleteCategory', 'DELETE'),
    reorderCategories: adminAction('api/admin/reorderCategories', 'POST'),
    listTags: adminAction('api/admin/listTags', 'GET'),
    upsertTag: adminAction('api/admin/upsertTag', 'POST'),
    deleteTag: adminAction('api/admin/deleteTag', 'DELETE'),
    listImages: adminAction('api/admin/listImages', 'GET'),
    uploadImage: adminAction('api/admin/uploadImage', 'POST'),
    deleteImage: adminAction('api/admin/deleteImage', 'DELETE'),
    updateImageNote: adminAction('api/admin/updateImageNote', 'PATCH'),
    recalculateImageThumbhash: adminAction('api/admin/recalculateImageThumbhash', 'POST'),
    listMusic: adminAction('api/admin/listMusic', 'GET'),
    searchMusic: adminAction('api/admin/searchMusic', 'GET'),
    addMusic: adminAction('api/admin/addMusic', 'POST'),
    updateMusic: adminAction('api/admin/updateMusic', 'PATCH'),
    deleteMusic: adminAction('api/admin/deleteMusic', 'DELETE'),
    listPages: adminAction('api/admin/listPages', 'GET'),
    getPage: adminAction('api/admin/getPage', 'GET'),
    upsertPageMeta: adminAction('api/admin/upsertPageMeta', 'POST'),
    deletePage: adminAction('api/admin/deletePage', 'DELETE'),
    restorePage: adminAction('api/admin/restorePage', 'POST'),
    listPageRevisions: adminAction('api/admin/listPageRevisions', 'GET'),
    saveDraft: adminAction('api/admin/saveDraft', 'POST'),
    publishLatest: adminAction('api/admin/publishLatest', 'POST'),
    unpublishPage: adminAction('api/admin/unpublishPage', 'POST'),
    previewPage: adminAction('api/admin/previewPage', 'POST'),
    listPosts: adminAction('api/admin/listPosts', 'GET'),
    getPost: adminAction('api/admin/getPost', 'GET'),
    upsertPostMeta: adminAction('api/admin/upsertPostMeta', 'POST'),
    deletePost: adminAction('api/admin/deletePost', 'DELETE'),
    restorePost: adminAction('api/admin/restorePost', 'POST'),
    listPostRevisions: adminAction('api/admin/listPostRevisions', 'GET'),
    savePostDraft: adminAction('api/admin/savePostDraft', 'POST'),
    publishPostLatest: adminAction('api/admin/publishPostLatest', 'POST'),
    unpublishPost: adminAction('api/admin/unpublishPost', 'POST'),
    previewPost: adminAction('api/admin/previewPost', 'POST'),
    renderMath: adminAction('api/admin/renderMath', 'POST'),
    renderMermaid: adminAction('api/admin/renderMermaid', 'POST'),
    reindexSearch: adminAction('api/admin/reindexSearch', 'POST'),
    approveCommentDeletion: adminAction('api/admin/approveCommentDeletion', 'POST'),
    listPendingDashboard: adminAction('api/admin/listPendingDashboard', 'GET'),
    inviteAuthor: adminAction('api/admin/inviteAuthor', 'POST'),
    updateUserRole: adminAction('api/admin/updateUserRole', 'POST'),
    sendPasswordReset: adminAction('api/admin/sendPasswordReset', 'POST'),
    revokeSession: adminAction('api/admin/revokeSession', 'POST'),
    revokeUserSessions: adminAction('api/admin/revokeUserSessions', 'POST'),
  },
} as const

// Empty — all API routes now live in the Hono layer.
export const API_ACTION_LIST: readonly { route: string; path: string; method: ApiActionMethod; file: string }[] =
  [] as const
