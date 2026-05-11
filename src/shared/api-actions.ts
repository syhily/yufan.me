export type ApiActionMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

// `defineApiAction` is the single source of truth for every internal API
// action. It returns a descriptor that the client uses (`API_ACTIONS.x.y`),
// the server route module imports (the `route` is also the URL), AND the
// route manifest `src/routes.ts` consumes — `file` is the on-disk path of
// the matching resource route module, derived deterministically from
// `route` so adding a new endpoint touches exactly one file.
//
// The `route` shape MUST follow `api/actions/<domain>/<name>`. The matching
// module path then is `routes/api/actions/<domain>.<name>.ts`. We assert
// the shape with a readable error so a typo is caught at module load.
function defineApiAction<const Route extends string, const Method extends ApiActionMethod>(
  route: Route,
  method: Method,
) {
  const segments = route.split('/')
  if (segments.length !== 4 || segments[0] !== 'api' || segments[1] !== 'actions') {
    throw new Error(
      `defineApiAction: expected route shape 'api/actions/<domain>/<name>', received '${route}'. ` +
        `The shape feeds the auto-generated route manifest in src/routes.ts; please follow the convention.`,
    )
  }
  const file = `routes/api/actions/${segments[2]}.${segments[3]}.ts` as const
  return {
    route,
    path: `/${route}` as const,
    method,
    file,
  }
}

export const API_ACTIONS = {
  auth: {
    // The browser sign-in / sign-up flows go directly through React Router's
    // `<Form>` -> route `action`. Only mutations that genuinely need a JSON
    // channel remain here.
    updateUser: defineApiAction('api/actions/auth/updateUser', 'PATCH'),
  },
  comment: {
    increaseLike: defineApiAction('api/actions/comment/increaseLike', 'POST'),
    decreaseLike: defineApiAction('api/actions/comment/decreaseLike', 'DELETE'),
    validateLikeToken: defineApiAction('api/actions/comment/validateLikeToken', 'POST'),
    findAvatar: defineApiAction('api/actions/comment/findAvatar', 'POST'),
    replyComment: defineApiAction('api/actions/comment/replyComment', 'POST'),
    approve: defineApiAction('api/actions/comment/approve', 'PATCH'),
    delete: defineApiAction('api/actions/comment/delete', 'DELETE'),
    loadComments: defineApiAction('api/actions/comment/loadComments', 'GET'),
    getRaw: defineApiAction('api/actions/comment/getRaw', 'GET'),
    edit: defineApiAction('api/actions/comment/edit', 'PATCH'),
    searchPages: defineApiAction('api/actions/comment/searchPages', 'GET'),
    searchAuthors: defineApiAction('api/actions/comment/searchAuthors', 'GET'),
    loadAll: defineApiAction('api/actions/comment/loadAll', 'POST'),
  },
  image: {
    resolveThumbhash: defineApiAction('api/actions/image/resolveThumbhash', 'GET'),
  },
  music: {
    get: defineApiAction('api/actions/music/get', 'GET'),
  },
  admin: {
    listUsers: defineApiAction('api/actions/admin/listUsers', 'GET'),
    getUser: defineApiAction('api/actions/admin/getUser', 'POST'),
    softDeleteUser: defineApiAction('api/actions/admin/softDeleteUser', 'DELETE'),
    restoreUser: defineApiAction('api/actions/admin/restoreUser', 'POST'),
    muteUser: defineApiAction('api/actions/admin/muteUser', 'PATCH'),
    bulkApproveUserComments: defineApiAction('api/actions/admin/bulkApproveUserComments', 'POST'),
    bulkSoftDeleteUserComments: defineApiAction('api/actions/admin/bulkSoftDeleteUserComments', 'DELETE'),
    getSettings: defineApiAction('api/actions/admin/getSettings', 'GET'),
    updateSettings: defineApiAction('api/actions/admin/updateSettings', 'PATCH'),
    getCacheStats: defineApiAction('api/actions/admin/getCacheStats', 'GET'),
    clearCache: defineApiAction('api/actions/admin/clearCache', 'POST'),
    sendTestMail: defineApiAction('api/actions/admin/sendTestMail', 'POST'),
    listFriends: defineApiAction('api/actions/admin/listFriends', 'GET'),
    upsertFriend: defineApiAction('api/actions/admin/upsertFriend', 'POST'),
    deleteFriend: defineApiAction('api/actions/admin/deleteFriend', 'DELETE'),
    listCategories: defineApiAction('api/actions/admin/listCategories', 'GET'),
    upsertCategory: defineApiAction('api/actions/admin/upsertCategory', 'POST'),
    deleteCategory: defineApiAction('api/actions/admin/deleteCategory', 'DELETE'),
    reorderCategories: defineApiAction('api/actions/admin/reorderCategories', 'POST'),
    listTags: defineApiAction('api/actions/admin/listTags', 'GET'),
    upsertTag: defineApiAction('api/actions/admin/upsertTag', 'POST'),
    deleteTag: defineApiAction('api/actions/admin/deleteTag', 'DELETE'),
    listImages: defineApiAction('api/actions/admin/listImages', 'GET'),
    uploadImage: defineApiAction('api/actions/admin/uploadImage', 'POST'),
    deleteImage: defineApiAction('api/actions/admin/deleteImage', 'DELETE'),
    updateImageNote: defineApiAction('api/actions/admin/updateImageNote', 'PATCH'),
    recalculateImageThumbhash: defineApiAction('api/actions/admin/recalculateImageThumbhash', 'POST'),
    listMusic: defineApiAction('api/actions/admin/listMusic', 'GET'),
    searchMusic: defineApiAction('api/actions/admin/searchMusic', 'GET'),
    addMusic: defineApiAction('api/actions/admin/addMusic', 'POST'),
    updateMusic: defineApiAction('api/actions/admin/updateMusic', 'PATCH'),
    deleteMusic: defineApiAction('api/actions/admin/deleteMusic', 'DELETE'),
    listPages: defineApiAction('api/actions/admin/listPages', 'GET'),
    getPage: defineApiAction('api/actions/admin/getPage', 'GET'),
    upsertPageMeta: defineApiAction('api/actions/admin/upsertPageMeta', 'POST'),
    deletePage: defineApiAction('api/actions/admin/deletePage', 'DELETE'),
    restorePage: defineApiAction('api/actions/admin/restorePage', 'POST'),
    listPageRevisions: defineApiAction('api/actions/admin/listPageRevisions', 'GET'),
    saveDraft: defineApiAction('api/actions/admin/saveDraft', 'POST'),
    publishLatest: defineApiAction('api/actions/admin/publishLatest', 'POST'),
    unpublishPage: defineApiAction('api/actions/admin/unpublishPage', 'POST'),
    previewPage: defineApiAction('api/actions/admin/previewPage', 'POST'),
    listPosts: defineApiAction('api/actions/admin/listPosts', 'GET'),
    getPost: defineApiAction('api/actions/admin/getPost', 'GET'),
    upsertPostMeta: defineApiAction('api/actions/admin/upsertPostMeta', 'POST'),
    deletePost: defineApiAction('api/actions/admin/deletePost', 'DELETE'),
    restorePost: defineApiAction('api/actions/admin/restorePost', 'POST'),
    listPostRevisions: defineApiAction('api/actions/admin/listPostRevisions', 'GET'),
    savePostDraft: defineApiAction('api/actions/admin/savePostDraft', 'POST'),
    publishPostLatest: defineApiAction('api/actions/admin/publishPostLatest', 'POST'),
    unpublishPost: defineApiAction('api/actions/admin/unpublishPost', 'POST'),
    previewPost: defineApiAction('api/actions/admin/previewPost', 'POST'),
    renderMath: defineApiAction('api/actions/admin/renderMath', 'POST'),
    renderMermaid: defineApiAction('api/actions/admin/renderMermaid', 'POST'),
    reindexSearch: defineApiAction('api/actions/admin/reindexSearch', 'POST'),
  },
} as const

export const API_ACTION_LIST = [
  ...Object.values(API_ACTIONS.auth),
  ...Object.values(API_ACTIONS.comment),
  ...Object.values(API_ACTIONS.image),
  ...Object.values(API_ACTIONS.music),
  ...Object.values(API_ACTIONS.admin),
] as const
