console.log("workitems.js module loaded");

// LOAD tasks from Supabase
async function loadWorkItemsFromDB(){

  // 🔥 GET LOGGED-IN USER
  const { data: userData } = await supabaseClient.auth.getUser();

  if(!userData || !userData.user){
    console.error("No user logged in");
    return;
  }

  const { data, error } = await supabaseClient
    .from("work_items")
    .select("*")
    .eq("user_id", userData.user.id);   // ✅ FILTER BY USER

  if(error){
    console.error("Error loading items:", error);
    return;
  }

  if(data){
    workItems = data.map(item => ({
      id: item.id,
      projId: item.project_id,
      type: item.type,
      title: item.title,
      status: item.status,
      prio: item.priority,
      assignee: item.assignee_id,
      start: item.start_date,
      due: item.due_date,
      desc: item.description
    }));

    renderCurrentView();
    updateBadge();
  }

}


// SAVE new task
async function saveWorkItemToDB(item){

  // 🔥 GET LOGGED-IN USER
  const { data: userData } = await supabaseClient.auth.getUser();

  if(!userData || !userData.user){
    console.error("No user logged in");
    return;
  }

  const { error } = await supabaseClient
    .from("work_items")
    .insert({
      id: item.id,
      project_id: item.projId,
      title: item.title,
      description: item.desc,
      type: item.type,
      status: item.status,
      priority: item.prio,
      assignee_id: item.assignee,
      start_date: item.start,
      due_date: item.due,
      user_id: userData.user.id   // ✅ MUST HAVE
    });

  if(error){
    console.error("Insert error:", error);
  }

}


// UPDATE status when card moved
async function updateStatusInDB(id,newStatus){

  // 🔥 GET LOGGED-IN USER
  const { data: userData } = await supabaseClient.auth.getUser();

  if(!userData || !userData.user){
    console.error("No user logged in");
    return;
  }

  const { error } = await supabaseClient
    .from("work_items")
    .update({ status:newStatus })
    .eq("id", id)
    .eq("user_id", userData.user.id);   // ✅ EXTRA SAFETY

  if(error){
    console.error("Status update error:", error);
  }

}