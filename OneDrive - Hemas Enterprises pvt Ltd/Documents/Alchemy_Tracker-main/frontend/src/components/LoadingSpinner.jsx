export default function LoadingSpinner() {
  return (
    <div className="grid place-items-center p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
    </div>
  );
}