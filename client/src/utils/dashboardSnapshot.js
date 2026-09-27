export function isCurrentDashboardSnapshot(snapshot, { userId, selectedDate, requestToken }) {
  return (
    snapshot.userId === userId &&
    snapshot.date === selectedDate &&
    snapshot.requestToken === requestToken
  );
}

export function shouldRefreshDashboardDate(affectedDate, selectedDate) {
  return affectedDate === selectedDate;
}
