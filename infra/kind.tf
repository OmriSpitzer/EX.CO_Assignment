resource "kind_cluster" "exco" {
  name            = "exco"
  wait_for_ready  = true
  kubeconfig_path = "${path.module}/kubeconfig"

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    node {
      role = "control-plane"

      # kind 0.33 writes this into the kubelet node-labels list.
      # A kubeadm merge patch would replace that whole list on kubeadm v1beta4.
      labels = {
        "ingress-ready" = "true"
      }

      extra_port_mappings {
        container_port = 80
        host_port      = 8080
        protocol       = "TCP"
      }

      extra_port_mappings {
        container_port = 443
        host_port      = 8443
        protocol       = "TCP"
      }
    }

    node {
      role = "worker"
    }

    node {
      role = "worker"
    }
  }
}
