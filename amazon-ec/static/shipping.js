"use strict";
const byId = id => document.getElementById(id);

function formatPaymentStatus(status) {
    switch (status) {
        case "unpaid":
            return "未決済";
        case "paid":
            return "決済済み";
        case "refunded":
            return "返金済み";
        case "refund_failed":
            return "返金失敗";
        default:
            return status || "未決済";
    }
}

async function api(path, options = {}) {
    const res = await fetch(path, { credentials: "same-origin", ...options });
    if (!res.ok) throw new Error((await res.text()).trim() || `HTTP ${res.status}`);
    return res.json();
}

async function postOrderAction(path, orderId, confirmText, successMessage, buttons) {
    if (!confirm(confirmText)) return;
    buttons.forEach(b => b.disabled = true);
    try {
        await api(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: orderId })
        });
        await load();
        byId("message").textContent = successMessage;
    } catch (e) {
        byId("message").textContent = e.message;
        await load().catch(() => {});
    }
}

async function load() {
    const orders = await api("/api/admin/shipments");
    const tbody = byId("shipments");
    tbody.replaceChildren();
    for (const order of orders) {
        const tr = document.createElement("tr");
        for (const value of [
            order.id,
            order.product_name,
            order.quantity,
            order.created_at,
            formatPaymentStatus(order.payment_status),
            order.shipping_status
        ]) {
            const td = document.createElement("td");
            td.textContent = String(value);
            tr.appendChild(td);
        }
        const td = document.createElement("td");
        if (order.payment_status === "paid" && order.shipping_status === "受付") {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = "発送済みにする";
            btn.addEventListener("click", () => {
                postOrderAction(
                    "/api/admin/shipments/dispatch",
                    order.id,
                    `注文 ${order.id} を発送済みにしますか？`,
                    "発送状態を更新しました。",
                    [btn]
                );
            });
            td.appendChild(btn);
        } else if (order.shipping_status === "返品申請中") {
            const approveBtn = document.createElement("button");
            approveBtn.type = "button";
            approveBtn.textContent = "返品承認・返金";

            const rejectBtn = document.createElement("button");
            rejectBtn.type = "button";
            rejectBtn.textContent = "返品却下";

            const failBtn = document.createElement("button");
            failBtn.type = "button";
            failBtn.textContent = "返金失敗記録";

            const actionButtons = [approveBtn, rejectBtn, failBtn];

            approveBtn.addEventListener("click", () => {
                postOrderAction(
                    "/api/admin/returns/approve",
                    order.id,
                    `注文 ${order.id} の返品を承認し、在庫戻しと返金を実行しますか？`,
                    "返品承認・在庫戻し・返金処理を完了しました。",
                    actionButtons
                );
            });

            rejectBtn.addEventListener("click", () => {
                postOrderAction(
                    "/api/admin/returns/reject",
                    order.id,
                    `注文 ${order.id} の返品申請を却下しますか？`,
                    "返品申請を却下しました。",
                    actionButtons
                );
            });

            failBtn.addEventListener("click", () => {
                postOrderAction(
                    "/api/admin/returns/refund-fail",
                    order.id,
                    `注文 ${order.id} の返金失敗を記録しますか？`,
                    "返金失敗を記録しました。",
                    actionButtons
                );
            });

            td.appendChild(approveBtn);
            td.append(" ");
            td.appendChild(rejectBtn);
            td.append(" ");
            td.appendChild(failBtn);
        } else {
            td.textContent = "－";
        }
        tr.appendChild(td);
        tbody.appendChild(tr);
    }
}

async function init() {
    try {
        const me = await api("/api/me");
        if (!me.is_admin) throw new Error("管理者権限がありません");
        byId("panel").hidden = false;
        byId("message").textContent = `管理者：${me.username}`;
        await load();
    } catch (e) {
        byId("message").textContent = e.message;
    }
}

byId("reload").addEventListener("click", () => load().catch(e => byId("message").textContent = e.message));
init();