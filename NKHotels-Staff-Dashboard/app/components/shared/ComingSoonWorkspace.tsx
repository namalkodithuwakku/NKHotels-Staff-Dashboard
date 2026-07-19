export default function ComingSoonWorkspace({ title, description }: { title: string; description: string }) {
  return <div className="coming-soon-workspace"><span>NK</span><small>WORKSPACE MODULE</small><h2>{title}</h2><p>{description}</p><b>Planned for the Supabase migration</b></div>;
}
