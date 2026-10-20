import { Link } from "react-router-dom";
import { Empty } from "../components/ui";
export default function NotFound() {
  return <Empty title="Page not found" action={<Link to="/" className="btn btn-primary">Back to home</Link>}>The link may be incorrect or the page may have moved.</Empty>;
}
