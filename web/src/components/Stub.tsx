export default function Stub({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">Em construção.</p>
    </div>
  );
}
