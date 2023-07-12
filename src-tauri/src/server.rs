use crate::project::ActiveProject;
use log::{error, info};
use matchit::Router;
use std::error::Error;
use std::fs;
use std::sync::RwLock;
use tauri::http::{Request, Response, ResponseBuilder};
use tauri::{AppHandle, Manager, Wry};

pub struct ResourceRouter(pub RwLock<Router<ResourceType>>);

impl ResourceRouter {
    pub fn new() -> Self {
        let mut router = Router::new();
        router
            .insert("/project/*bundle", ResourceType::Bundle)
            .unwrap();
        router.insert("/*path", ResourceType::External).unwrap();

        ResourceRouter(RwLock::new(router))
    }
}

#[derive(Debug)]
pub enum ResourceType {
    Bundle,
    External,
}

pub fn handle_ace_request(app: &AppHandle<Wry>, req: &Request) -> Result<Response, Box<dyn Error>> {
    info!("{} {}", req.method(), req.uri());
    let resource_router = app.state::<ResourceRouter>().inner();
    let active_project = app.state::<ActiveProject>().inner();

    let router = resource_router.0.read().unwrap();

    let project = active_project
        .0
        .read()
        .unwrap()
        .clone()
        .ok_or("No project currently loaded")?;

    let path = req.uri().replace("ace://localhost", "");
    let response = match router.at(path.as_str()) {
        Ok(matched) => {
            let file_path = match matched.value {
                ResourceType::Bundle => project
                    .path
                    .join(project.config.paths.bundles.as_path())
                    .join(matched.params.get("bundle").unwrap()),
                ResourceType::External => project
                    .path
                    .join(project.config.paths.html_ui.as_path())
                    .join(matched.params.get("path").unwrap()),
            };
            info!("Resolved to {:?} {}", matched.value, file_path.display());
            match fs::read(file_path) {
                Ok(data) => ResponseBuilder::new()
                    .status(200)
                    .header("Access-Control-Allow-Origin", "*")
                    .body(data)
                    .unwrap(),
                Err(err) => {
                    error!("{err}");
                    ResponseBuilder::new()
                        .status(404)
                        .body("Unknown path".as_bytes().to_vec())
                        .unwrap()
                }
            }
        }
        Err(err) => {
            error!("{err}");
            ResponseBuilder::new()
                .status(404)
                .body("Unknown path".as_bytes().to_vec())
                .unwrap()
        }
    };

    Ok(response)
}
