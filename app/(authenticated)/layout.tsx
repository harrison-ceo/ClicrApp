import { AppLayout } from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/server";
import { getRoleForUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const role = await getRoleForUser(user.id);
    return <AppLayout role={role}>{children}</AppLayout>;
}
