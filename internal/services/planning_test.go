package services

import (
	"testing"

	"github.com/ws/jira-cli/internal/models"
)

func TestBuildPlanningTreeFiltersRejectedChildren(t *testing.T) {
	service := &PlanningService{}
	issues := []models.IssueItem{
		{Key: "PARENT-1", Summary: "父任务", Status: "进行中"},
		{Key: "CHILD-1", ParentKey: "PARENT-1", Status: "待办"},
		{Key: "CHILD-2", ParentKey: "PARENT-1", Status: "已拒绝"},
	}

	tree := service.BuildPlanningTree(issues)
	if len(tree) != 1 {
		t.Fatalf("expected one parent, got %d", len(tree))
	}
	if len(tree[0].Children) != 1 {
		t.Fatalf("expected one visible child, got %d", len(tree[0].Children))
	}
	if tree[0].Children[0].Key != "CHILD-1" {
		t.Fatalf("expected CHILD-1, got %s", tree[0].Children[0].Key)
	}
}

func TestBuildPlanningTreeDoesNotCreateVirtualParentForRejectedChild(t *testing.T) {
	service := &PlanningService{}
	issues := []models.IssueItem{
		{Key: "CHILD-1", ParentKey: "PARENT-1", Status: " 已拒绝 "},
	}

	tree := service.BuildPlanningTree(issues)
	if len(tree) != 0 {
		t.Fatalf("expected rejected child to be omitted, got %d tree nodes", len(tree))
	}
}
