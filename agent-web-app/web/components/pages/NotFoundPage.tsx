import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <p>
      Nothing here. <Link to="/" className="underline">Back to agents</Link>
    </p>
  );
}
