import ProductMedia from "../product/ProductMedia";
import { toPrice } from "../../utils/format";

function AdminOverlay({
  settingsDraft,
  onSettingsDraftChange,
  onSaveSettings,
  onHeroUpload,
  productDraft,
  onProductDraftChange,
  onProductSubmit,
  onProductUpload,
  isEditing,
  onCancelEdit,
  products,
  onStartEdit,
  onRemoveProduct,
  adminMessage,
  onClose
}) {
  return (
    <div className="admin-overlay" role="dialog" aria-modal="true" aria-label="Product manager">
      <div className="admin-panel">
        <div className="admin-header">
          <h2>Store Manager</h2>
          <button type="button" onClick={onClose} aria-label="Close manager">
            Close
          </button>
        </div>

        <div className="admin-body">
          <form className="card" onSubmit={onSaveSettings}>
            <h3>Brand Settings</h3>
            <label>
              Brand name
              <input
                value={settingsDraft.brandName}
                onChange={(event) => onSettingsDraftChange("brandName", event.target.value)}
              />
            </label>
            <label>
              Hero title
              <input
                value={settingsDraft.heroTitle}
                onChange={(event) => onSettingsDraftChange("heroTitle", event.target.value)}
              />
            </label>
            <label>
              Hero subtitle
              <input
                value={settingsDraft.heroSubtitle}
                onChange={(event) => onSettingsDraftChange("heroSubtitle", event.target.value)}
              />
            </label>
            <label>
              Hero button label
              <input
                value={settingsDraft.heroButtonLabel}
                onChange={(event) => onSettingsDraftChange("heroButtonLabel", event.target.value)}
              />
            </label>
            <label>
              Hero image URL
              <input
                placeholder="https://..."
                value={settingsDraft.heroImage}
                onChange={(event) => onSettingsDraftChange("heroImage", event.target.value)}
              />
            </label>
            <label>
              Or upload hero image
              <input type="file" accept="image/*" onChange={onHeroUpload} />
            </label>
            <button type="submit">Save Settings</button>
          </form>

          <form className="card" onSubmit={onProductSubmit}>
            <h3>{isEditing ? "Edit Product" : "Add Product"}</h3>
            <label>
              Product name
              <input
                value={productDraft.name}
                onChange={(event) => onProductDraftChange("name", event.target.value)}
              />
            </label>
            <label>
              Price (USD)
              <input
                type="number"
                min="0"
                step="1"
                value={productDraft.price}
                onChange={(event) => onProductDraftChange("price", event.target.value)}
              />
            </label>
            <label>
              Placement
              <select
                value={productDraft.section}
                onChange={(event) => onProductDraftChange("section", event.target.value)}
              >
                <option value="arrival">New Arrivals grid</option>
                <option value="featured">Large featured row</option>
              </select>
            </label>
            <label>
              Fallback frame style
              <select
                value={productDraft.variant}
                onChange={(event) => onProductDraftChange("variant", event.target.value)}
              >
                <option value="round">Round</option>
                <option value="tortoise">Tortoise</option>
                <option value="cat">Cat-Eye</option>
                <option value="clear">Clear</option>
              </select>
            </label>
            <label>
              Product image URL
              <input
                placeholder="https://..."
                value={productDraft.image}
                onChange={(event) => onProductDraftChange("image", event.target.value)}
              />
            </label>
            <label>
              Or upload product image
              <input type="file" accept="image/*" onChange={onProductUpload} />
            </label>
            <div className="button-row">
              <button type="submit">{isEditing ? "Update Product" : "Add Product"}</button>
              {isEditing ? (
                <button type="button" className="secondary" onClick={onCancelEdit}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          <div className="card list-card">
            <h3>Current Products</h3>
            <ul>
              {products.map((product) => (
                <li key={product.id}>
                  <div className="mini-media">
                    <ProductMedia product={product} />
                  </div>
                  <div>
                    <strong>{product.name}</strong>
                    <span>
                      {toPrice(product.price)} |{" "}
                      {product.section === "arrival" ? "New Arrivals" : "Featured"}
                    </span>
                  </div>
                  <div className="list-actions">
                    <button type="button" onClick={() => onStartEdit(product)}>
                      Edit
                    </button>
                    <button type="button" className="danger" onClick={() => onRemoveProduct(product.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {adminMessage ? <p className="admin-message">{adminMessage}</p> : null}
      </div>
    </div>
  );
}

export default AdminOverlay;
