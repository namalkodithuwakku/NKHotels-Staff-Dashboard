type Props = {
  properties: number;
  staff: number;
  urgent: number;
  completed: number;
};

function Card({
  title,
  value,
  color,
  icon,
}: {
  title: string;
  value: number;
  color: string;
  icon: string;
}) {
  return (
    <div className="metric glass-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            color: "#64748b",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {title}
        </span>

        <span style={{ fontSize: 24 }}>{icon}</span>
      </div>

      <div
        style={{
          fontSize: 44,
          fontWeight: 800,
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function CompanyStats({
  properties,
  staff,
  urgent,
  completed,
}: Props) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4,minmax(0,1fr))",
        gap: 18,
        marginBottom: 24,
      }}
    >
      <Card
        title="Properties"
        value={properties}
        color="#2563eb"
        icon="🏨"
      />

      <Card
        title="Staff Online"
        value={staff}
        color="#0f766e"
        icon="👥"
      />

      <Card
        title="Urgent Tasks"
        value={urgent}
        color="#dc2626"
        icon="🚨"
      />

      <Card
        title="Completed Today"
        value={completed}
        color="#16a34a"
        icon="✅"
      />
    </section>
  );
}