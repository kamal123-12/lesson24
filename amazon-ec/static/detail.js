let currentProduct = null;

document.addEventListener("DOMContentLoaded", () => {
    checkAdminLinks();

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get("id");

    if (!productId) {
        alert("商品IDが指定されていません。");
        window.location.href = "index.html";
        return;
    }

    loadProductDetail(productId);
});

async function checkAdminLinks() {
    const adminLinks = document.getElementById("admin-links");
    if (!adminLinks) return;
    try {
        const res = await fetch("/api/me");
        if (res.ok) {
            const user = await res.json();
            adminLinks.hidden = !user.is_admin;
        }
    } catch (_) {
        // 未ログイン時は非表示のまま
    }
}

function loadProductDetail(productId) {
    // 商品情報の取得と表示
    fetch(`/api/product?id=${productId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error("商品情報の取得に失敗しました。");
            }
            return response.json();
        })
        .then(product => {
            currentProduct = product;

            // 第22回追加：商品画像の表示
            const image = document.getElementById("product-image");

            if (image) {
                if (product.image_url) {
                    image.src = product.image_url;
                    image.hidden = false;
                } else {
                    image.removeAttribute("src");
                    image.hidden = true;
                }
            }

            // 商品名・価格・在庫の表示
            document.getElementById("product-name").innerText = product.name;
            document.getElementById("product-price").innerText =
                `¥${product.price.toLocaleString()}`;

            const stockEl = document.getElementById("product-stock");
            const qtyInput = document.getElementById("quantity");
            const orderBtn = document.getElementById("order-btn");
            const addToCartBtn = document.getElementById("add-to-cart-btn");

            const isOutOfStock = product.stock <= 0;
            if (stockEl) {
                stockEl.innerText = isOutOfStock ? "在庫なし（在庫: 0）" : `在庫: ${product.stock}`;
            }

            if (isOutOfStock) {
                qtyInput.disabled = true;
                orderBtn.disabled = true;
                orderBtn.innerText = "在庫切れ";
                addToCartBtn.disabled = true;
            } else {
                qtyInput.disabled = false;
                qtyInput.max = String(product.stock);
                orderBtn.disabled = false;
                orderBtn.innerText = "注文する";
                addToCartBtn.disabled = false;
            }

            // 既存の「注文する」ボタン
            orderBtn.onclick = () => orderDetailProduct(product.id);

            // 第18回追加：「カートに入れる」ボタン
            addToCartBtn.onclick = () => addToCart();
        })
        .catch(error => {
            console.error(error);
            alert("商品の読み込みに失敗しました。");
        });
}

// カートに追加する処理
function addToCart() {
    if (!currentProduct) return;
    if (currentProduct.stock <= 0) {
        alert("在庫切れのためカートに追加できません。");
        return;
    }

    const qtyInput = document.getElementById("quantity");
    const quantity = parseInt(qtyInput.value, 10);

    if (isNaN(quantity) || quantity <= 0) {
        alert("正当な数量を入力してください。");
        return;
    }

    // localStorageから既存カートの取得
    let cart = JSON.parse(localStorage.getItem("cart")) || [];

    // すでに同じ商品がカート内にあるか確認
    const existingIndex = cart.findIndex(
        item => item.id === currentProduct.id
    );

    const currentInCart = existingIndex !== -1 ? cart[existingIndex].quantity : 0;
    if (currentInCart + quantity > currentProduct.stock) {
        alert(`在庫数（${currentProduct.stock}）を超える数量はカートに入れられません。`);
        return;
    }

    if (existingIndex !== -1) {
        // 同じ商品が存在する場合は数量を加算
        cart[existingIndex].quantity += quantity;
    } else {
        // 新規商品の場合は追加
        cart.push({
            id: currentProduct.id,
            name: currentProduct.name,
            price: currentProduct.price,
            quantity: quantity
        });
    }

    // localStorageに保存
    localStorage.setItem("cart", JSON.stringify(cart));

    // メッセージ表示
    const msgDiv = document.getElementById("message");
    msgDiv.innerText = "カートに追加しました";
    msgDiv.style.display = "block";

    setTimeout(() => {
        msgDiv.style.display = "none";
    }, 3000);
}

// 既存の注文処理
async function orderDetailProduct(productId) {
    const qtyInput = document.getElementById("quantity");
    const quantity = parseInt(qtyInput.value, 10);

    if (isNaN(quantity) || quantity <= 0) {
        alert("正当な数量を入力してください。");
        return;
    }

    const payload = {
        product_id: productId,
        quantity: quantity
    };

    try {
        const response = await fetch("/api/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errText = (await response.text()).trim();
            throw new Error(errText || "注文処理に失敗しました。");
        }
        const data = await response.json();
        if (!Number.isSafeInteger(data.id) || data.id <= 0) {
            throw new Error("注文IDを取得できませんでした。");
        }

        window.location.href = `payment.html?orders=${data.id}`;
    } catch (error) {
        console.error(error);
        alert(error.message || "注文に失敗しました。");
        loadProductDetail(productId);
    }
}