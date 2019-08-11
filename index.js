(async () => {
  const endpoints = {
    orgs: () => "/services/orgs/sub-org-name-hierarchy",
    subOrg: subOrgId =>
      `/services/orgs/sub-orgs-with-callings?subOrgId=${subOrgId}`,
    member: id => `/records/member-profile/service/${id}`,
    memberCard: id => `/services/member-card?id=${id}`
  };

  const orgClasses = {
    M: {
      descr: "(P)riest, (T)eacher, (D)eacon",
      classes: {
        D: "DEACONS_QUORUM",
        P: "PRIESTS_QUORUM",
        T: "TEACHERS_QUORUM"
      }
    },
    W: {
      descr: "(L)aurel, (M)ia Maid, (B)eehive",
      classes: {
        B: "BEEHIVE",
        L: "LAUREL",
        M: "MIA_MAID"
      }
    }
  };

  const fetchJson = async url => {
    const response = await fetch(url);
    if (!response.ok) {
      throw Error(response.statusText);
    }
    return await response.json();
  };

  const getHouseholdEmail = async memberId => {
    const {
      household: { members }
    } = await fetchJson(endpoints.member(memberId));
    const { id: headOfHouseholdId } = members.find(
      ({ headOfHousehold }) => headOfHousehold
    );
    const { email } = await fetchJson(endpoints.memberCard(headOfHouseholdId));

    return email;
  };

  const jsonToCSV = data =>
    data.reduce(
      (acc1, member) =>
        acc1 +
        Object.values(member).reduce((acc2, field, idx) => {
          if (idx > 0) acc2 += ",";
          return `${acc2}"${field || ""}"`;
        }, "") +
        "\r\n",
      "Name, Email, Household Email\r\n"
    );

  const downloadData = (data, fileName) => {
    const file = new Blob([data], { type: "text/csv" });
    const url = URL.createObjectURL(file);

    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);

    a.click();
    URL.revokeObjectURL(url);

    document.body.removeChild(a);
  };

  const selectedOrgId = (
    prompt("Which organization do you want? Young (M)en or Young (W)omen") || ""
  ).toUpperCase();

  if (!selectedOrgId) return;

  if (orgClasses[selectedOrgId] === undefined) {
    alert("That is an invalid selection. Please choose M or W");

    return;
  }

  const selectedOrg = orgClasses[selectedOrgId];

  const selectedClasses = (
    prompt(`Which classes do you want to include? ${selectedOrg.descr}`) || ""
  ).toUpperCase();

  if (!selectedClasses) return;

  const isValidClassSelection = selectedClasses
    .split("")
    .some(
      selectedClass => !Object.keys(selectedOrg.classes).includes(selectedClass)
    );

  if (isValidClassSelection) {
    alert(
      `This is an invalid selection. Please choose ${Object.keys(
        selectedOrg.classes
      ).join(" or ")}`
    );

    return;
  }

  const orgs = await fetchJson(endpoints.orgs());
  const { subOrgId } = orgs.find(({ name }) => {
    if (selectedOrgId === "M" && name === "Young Men") return true;
    return selectedOrgId === "W" && name === "Young Women";
  });

  const youthOrg = await fetchJson(endpoints.subOrg(subOrgId));
  const youth = await Promise.all(
    youthOrg[0].children
      .filter(({ firstOrgType }) =>
        Object.entries(selectedOrg.classes).some(
          ([key, value]) =>
            selectedClasses.includes(key) && firstOrgType === value
        )
      )
      .reduce(
        (acc, { members }) =>
          acc.concat(
            members.map(async ({ email, householdEmail, id, name }) => {
              return {
                name,
                email,
                householdEmail: householdEmail || (await getHouseholdEmail(id))
              };
            })
          ),
        []
      )
  );

  downloadData(jsonToCSV(youth), `y${selectedOrgId.toLowerCase()}.csv`);
})();
