let groupsSidebarCache = {
  managed: [],
  joined: [],
  suggested: [],
}

export function getGroupsSidebarCache() {
  return groupsSidebarCache
}

export function setGroupsSidebarCache(next) {
  groupsSidebarCache = {
    managed: Array.isArray(next?.managed) ? next.managed : groupsSidebarCache.managed,
    joined: Array.isArray(next?.joined) ? next.joined : groupsSidebarCache.joined,
    suggested: Array.isArray(next?.suggested) ? next.suggested : groupsSidebarCache.suggested,
  }
  return groupsSidebarCache
}

export function removeGroupFromSidebarCache(groupId) {
  const normalize = (items) => (items || []).filter((item) => item?.id !== groupId)
  groupsSidebarCache = {
    managed: normalize(groupsSidebarCache.managed),
    joined: normalize(groupsSidebarCache.joined),
    suggested: normalize(groupsSidebarCache.suggested),
  }
  return groupsSidebarCache
}
