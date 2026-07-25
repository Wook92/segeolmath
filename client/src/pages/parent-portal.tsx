import { useSearch } from "wouter";
import StudentReportsPage from "./student-reports";
import ContactParentsPage from "./contact-parents";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@shared/schema";

export default function ParentPortalPage() {
  const { user } = useAuth();
  const search = useSearch();
  const urlParams = new URLSearchParams(search);
  const tabParam = urlParams.get("tab");

  const canContactParents = user && user.role >= UserRole.TEACHER;
  const showContact = tabParam === "contact" && canContactParents;

  return (
    <div>
      {showContact ? (
        <ContactParentsPage />
      ) : (
        <StudentReportsPage />
      )}
    </div>
  );
}
