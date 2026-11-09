provider "kind" {}

provider "kubernetes" {
  host                   = kind_cluster.exco.endpoint
  client_certificate     = kind_cluster.exco.client_certificate
  client_key             = kind_cluster.exco.client_key
  cluster_ca_certificate = kind_cluster.exco.cluster_ca_certificate
}

provider "helm" {
  kubernetes = {
    host                   = kind_cluster.exco.endpoint
    client_certificate     = kind_cluster.exco.client_certificate
    client_key             = kind_cluster.exco.client_key
    cluster_ca_certificate = kind_cluster.exco.cluster_ca_certificate
  }
}
