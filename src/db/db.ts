import { createClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

const supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
	auth: { persistSession: false },
});

export async function testInsert() {
	const { data, error } = await supabase.from("tests").insert({ money: 500 });
	console.log(data);
    console.error(error);
}
