export const SHOP_AREA_ADDRESSES = [
    'উত্তর মোহাম্মদপুর', 'দক্ষিণ মোহাম্মদপুর', 'আটিপাড়া', 'বায়নাগড়', 'পিপিয়া', 'মালিগাঁও', 'কালাসোনা', 'উত্তর নগর', 'দক্ষিণ নগর',
    'তালেরছেও', 'জোয়ারীখলা', 'বারৈয়ারা', 'সাচার', 'বুধুন্ডা', 'পালাখাল', 'টাগুড়িয়া', 'মাঝিগাছা', 'শিলাস্থান', 'মধুপুর', 'পিতাম্বর্দ্দি',
    'পেয়ারী খোলা'
];

export function populateAddressDropdown(elementId) {
    const addressSelect = document.getElementById(elementId);
    if (!addressSelect) return;

    addressSelect.innerHTML = '<option value="">ঠিকানা নির্বাচন করুন</option>';
    SHOP_AREA_ADDRESSES.forEach(address => {
        const option = document.createElement('option');
        option.value = address;
        option.textContent = address;
        addressSelect.appendChild(option);
    });
}