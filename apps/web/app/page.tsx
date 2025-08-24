export default function Page() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p>
        Static scaffold ready. Next steps: implement session creation/join, Supabase Auth (Google +
        Microsoft), and realtime updates.
      </p>
      <ul>
        <li>Next.js SSG export is enabled.</li>
        <li>Shared library will provide Black-76 pricing and Greeks.</li>
        <li>Supabase EU will back DB/Auth/Realtime.</li>
      </ul>
    </div>
  );
}