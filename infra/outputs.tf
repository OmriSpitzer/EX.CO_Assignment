output "kubeconfig_path" {
  value = kind_cluster.exco.kubeconfig_path
}

output "argocd_initial_admin_secret" {
  value = "argocd-initial-admin-secret"
}
