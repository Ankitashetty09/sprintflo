console.log("projects.js module loaded");

window.loadProjectsFromDB = async function(){

  const { data, error } = await supabaseClient
    .from("projects")
    .select("*");

  if(error){
    console.error("Error loading projects:", error);
    return;
  }

  if(data){

    projects = data.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color
    }));


    // set first project as active
    if(projects.length && !activeProj){
    activeProj = projects[0].id;
    }
    console.log("Projects loaded:", projects);

  }

}