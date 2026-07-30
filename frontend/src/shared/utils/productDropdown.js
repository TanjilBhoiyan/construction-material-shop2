// 🎯 প্রোডাক্ট সিলেক্ট ড্রপডাউন বসানোর shared লজিক — billing.ui.js এবং booking.ui.js
// দুই জায়গাতেই একই প্যাটার্নে (ডিফল্ট placeholder + প্রোডাক্ট লিস্ট) ড্রপডাউন বসাতে হতো, তাই এখানে

export function populateProductSelect(selectEl, products, labelFormatter) {
    selectEl.innerHTML = '';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.innerText = 'প্রোডাক্ট নির্বাচন করুন';
    defaultOpt.selected = true;
    defaultOpt.disabled = true; // যাতে এটা সিলেক্ট থাকা অবস্থায় কার্টে যোগ করা না যায়
    selectEl.appendChild(defaultOpt);

    products.forEach(prod => {
        const opt = document.createElement('option');
        opt.value = prod.id;
        opt.innerText = labelFormatter(prod);
        selectEl.appendChild(opt);
    });
}