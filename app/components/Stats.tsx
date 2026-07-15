type StatsData = {
  total: number;
  urgent: number;
  pending: number;
  active: number;
  completed: number;
};

export default function Stats({
  stats,
}: {
  stats: StatsData;
}) {
  return (
    <section className="metrics">
      <div className="metric urgent">
        <span>Urgent</span>
        <strong>{stats.urgent}</strong>
      </div>

      <div className="metric new">
        <span>Pending</span>
        <strong>{stats.pending}</strong>
      </div>

      <div className="metric active">
        <span>Active</span>
        <strong>{stats.active}</strong>
      </div>

      <div className="metric done">
        <span>Done</span>
        <strong>{stats.completed}</strong>
      </div>
    </section>
  );
}