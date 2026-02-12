import { createClient } from "@/lib/supabase/client";
import { Area } from "@/lib/types";

async function addArea(area: Area) {
    const supabase = createClient();
    const { data, error } = await supabase.from('areas').insert(area).select();
    if (error) {
        throw error;
    }
    return data;
}